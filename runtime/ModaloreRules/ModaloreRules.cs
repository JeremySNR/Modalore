// Original Modalore source. Values are replaced only with validated finite numbers.
using Terraria;
using Terraria.ModLoader;

namespace ModaloreRules;
public class ModaloreRules : Mod { }
public class RulePlayer : ModPlayer {
    public override void ModifyHitNPC(NPC target, ref NPC.HitModifiers modifiers) {
        if (!target.friendly && !target.townNPC) modifiers.FinalDamage *= __DAMAGE__f;
    }
}
public class RuleNPC : GlobalNPC {
    public override void SetDefaults(NPC npc) {
        if (!npc.friendly && !npc.townNPC && npc.lifeMax > 1) {
            npc.lifeMax = (int)System.Math.Clamp((double)npc.lifeMax * __HEALTH__f, 1d, (double)int.MaxValue);
            npc.life = npc.lifeMax;
            npc.value *= __COINS__f;
        }
    }
}
