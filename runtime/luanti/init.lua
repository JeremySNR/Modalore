local requested = {speed = __SPEED__, jump = __JUMP__, gravity = __GRAVITY__}
local function apply(player)
  if not player or not player:is_player() then return end
  player:set_physics_override(requested)
  local observed = player:get_physics_override()
  local result = {
    session = __SESSION__,
    engine = core.get_version(), game = core.get_game_info(),
    requested = requested,
    observed = {speed = observed.speed, jump = observed.jump, gravity = observed.gravity},
    matches = math.abs(observed.speed - requested.speed) < 0.001 and
      math.abs(observed.jump - requested.jump) < 0.001 and
      math.abs(observed.gravity - requested.gravity) < 0.001,
    evidence = "Connected player physics override readback; movement was not observed"
  }
  local file = io.open(core.get_worldpath() .. "/modalore-physics.json", "w")
  if file then file:write(core.write_json(result)); file:close() end
end
core.register_on_joinplayer(function(player)
  core.after(1, function() apply(player) end)
end)
core.register_on_respawnplayer(function(player)
  core.after(1, function() apply(player) end)
end)
