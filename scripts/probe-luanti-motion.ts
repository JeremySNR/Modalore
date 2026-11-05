/** Opt-in isolated motion telemetry, independent from the production launch path.
 * Run: npx tsx scripts/probe-luanti-motion.ts <Luanti installation root>
 * Uses Luanti's built-in --random-input, not OS input injection.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { detectLuanti, generateLuantiSource } from "../src/main/game/luanti.js";

const installation = process.argv[2];
if (!installation || process.argv.length !== 3)
  throw new Error("Provide the Luanti installation root");
const found = await detectLuanti([installation]);
if (!found.found || found.version !== "5.18.0" || !found.gameId)
  throw new Error("Luanti 5.18.0 and Minetest Game are required");
const root = path.resolve(".local", `luanti-motion-${randomUUID()}`);
const template = path.resolve("runtime/luanti/init.lua");
const instrumentation = `
core.register_node("motion_probe:floor", {description="Probe floor", tiles={"default_stone.png"}, diggable=false, groups={unbreakable=1}})
local samples = {}
local elapsed, sample_elapsed = 0, 0
local active = false
core.register_on_joinplayer(function(player)
  core.load_area({x=-48,y=-1,z=-48}, {x=48,y=5,z=48})
  for x=-48,48 do for z=-48,48 do core.set_node({x=x,y=0,z=z},{name="motion_probe:floor"}) end end
  core.after(2, function()
    if not player:is_player() then return end
    player:set_pos({x=0,y=1,z=0})
    active = true
  end)
end)
core.register_globalstep(function(dt)
  if not active then return end
  elapsed = elapsed + dt
  sample_elapsed = sample_elapsed + dt
  local player = core.get_connected_players()[1]
  if player and sample_elapsed >= 0.1 then
    sample_elapsed = 0
    local pos = player:get_pos()
    local control = player:get_player_control()
    samples[#samples+1] = {t=elapsed,x=pos.x,y=pos.y,z=pos.z,up=control.up,down=control.down,left=control.left,right=control.right,jump=control.jump,aux1=control.aux1}
  end
  if elapsed >= 18 then
    active = false
    local file = assert(io.open(core.get_worldpath() .. "/motion-samples.json", "w"))
    file:write(core.write_json({samples=samples})); file:close()
    core.request_shutdown("Motion probe complete", false, 0)
  end
end)
`;
type Sample = {
  t: number;
  x: number;
  y: number;
  z: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  aux1: boolean;
};
function summarize(samples: Sample[]) {
  let distance = 0,
    controlledDistance = 0,
    controlledIntervals = 0,
    movingControlledIntervals = 0;
  let jumpSamples = 0,
    auxSamples = 0,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    assert.ok([s.t, s.x, s.y, s.z].every(Number.isFinite));
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
    if (s.jump) jumpSamples++;
    if (s.aux1) auxSamples++;
    if (i === 0) continue;
    const previous = samples[i - 1],
      dt = s.t - previous.t;
    assert.ok(dt > 0);
    const delta = Math.hypot(s.x - previous.x, s.z - previous.z);
    distance += delta;
    if (s.up || s.down || s.left || s.right) {
      controlledIntervals++;
      controlledDistance += delta;
      if (delta > 0.01) movingControlledIntervals++;
    }
  }
  return {
    samples: samples.length,
    durationSeconds: samples.at(-1)!.t - samples[0].t,
    controlledIntervals,
    movingControlledIntervals,
    horizontalDistance: distance,
    horizontalDistanceDuringDirectionalControl: controlledDistance,
    jumpSamples,
    auxSamples,
    minY,
    maxY,
  };
}
async function run(
  label: string,
  speed: number,
  jump: number,
  gravity: number,
  session: number,
) {
  const folder = path.join(root, label),
    world = path.join(folder, "world"),
    mods = path.join(world, "worldmods"),
    rules = path.join(mods, "modalore_rules"),
    probe = path.join(mods, "motion_probe");
  await fs.mkdir(rules, { recursive: true });
  await fs.mkdir(probe, { recursive: true });
  await fs.writeFile(
    path.join(world, "world.mt"),
    `gameid = ${found.gameId}\nbackend = sqlite3\nplayer_backend = sqlite3\nauth_backend = sqlite3\nmod_storage_backend = sqlite3\n`,
  );
  await fs.writeFile(
    path.join(rules, "mod.conf"),
    "name = modalore_rules\ndepends = player_api\n",
  );
  await fs.writeFile(
    path.join(rules, "init.lua"),
    await generateLuantiSource(
      template,
      {
        schemaVersion: 2,
        game: "luanti-minetest-game",
        title: "Motion probe",
        description: "",
        speedMultiplier: speed,
        jumpMultiplier: jump,
        gravityMultiplier: gravity,
      },
      session,
    ),
  );
  await fs.writeFile(
    path.join(probe, "mod.conf"),
    "name = motion_probe\ndepends = modalore_rules, default\n",
  );
  await fs.writeFile(path.join(probe, "init.lua"), instrumentation);
  const config = path.join(folder, "luanti.conf");
  await fs.writeFile(
    config,
    "enable_server = false\nserver_announce = false\nbind_address = 127.0.0.1\nenable_ipv6 = false\nenable_sound = false\nenable_damage = false\nmg_name = singlenode\nsecure.enable_security = true\n",
  );
  const exe = path.join(path.resolve(installation!), "bin", "luanti.exe");
  const child = spawn(
    exe,
    [
      "--go",
      "--world",
      world,
      "--gameid",
      found.gameId!,
      "--config",
      config,
      "--logfile",
      path.join(folder, "debug.log"),
      "--random-input",
    ],
    {
      cwd: path.dirname(exe),
      shell: false,
      windowsHide: false,
      stdio: "ignore",
    },
  );
  const timer = setTimeout(() => child.kill(), 45000);
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.equal(code, 0, `${label} engine did not shut down cleanly`);
  } finally {
    clearTimeout(timer);
  }
  const physics = JSON.parse(
    await fs.readFile(path.join(world, "modalore-physics.json"), "utf8"),
  );
  assert.equal(physics.session, session);
  assert.equal(physics.matches, true);
  const data = JSON.parse(
    await fs.readFile(path.join(world, "motion-samples.json"), "utf8"),
  ) as { samples: Sample[] };
  const summary = summarize(data.samples);
  assert.ok(
    summary.samples >= 80 &&
      summary.controlledIntervals >= 10 &&
      summary.movingControlledIntervals >= 5,
    `${label}: insufficient controlled movement samples`,
  );
  return {
    requested: physics.requested,
    observed: physics.observed,
    ...summary,
  };
}
try {
  const baseline = await run("baseline", 1, 1, 1, 101);
  console.log("Baseline real-client telemetry collected.");
  const modified = await run("modified", 1.5, 1.4, 0.8, 102);
  console.log("Modified real-client telemetry collected.");
  const result = {
    engine: "Luanti 5.18.0",
    game: "Minetest Game",
    method:
      "Two fresh isolated singlenode worlds; indestructible flat floor, initial position set once before sampling, unchanged generated Modalore runtime, built-in --random-input, server samples at approximately 0.1 seconds for 18 seconds",
    inputSource:
      "https://github.com/luanti-org/luanti/blob/5.18.0/src/client/inputhandler.cpp",
    baseline,
    modified,
    limitations:
      "Random control durations, simultaneous keys, camera direction and latency differ between runs. Controls are sampled at interval endpoints, so do not necessarily represent the entire preceding interval. Distance and height are descriptive, not a controlled causal comparison of the individual multipliers. Position samples demonstrate player motion with directional controls; no human input or visually observed movement is claimed.",
  };
  await fs.writeFile(
    "docs/luanti-motion-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log("Saved sanitized motion telemetry summary.");
} catch (error) {
  console.error(
    `Motion probe failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
}
