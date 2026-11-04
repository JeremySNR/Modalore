// Original Modalore source. Values are replaced only with validated finite numbers.
using Terraria;
using Terraria.ModLoader;

namespace ModaloreRules;
public class ModaloreRules : Mod { }
public class RuleNPC : GlobalNPC {
    public override void ModifyIncomingHit(NPC npc, ref NPC.HitModifiers modifiers) {
        if (!npc.friendly && !npc.townNPC) modifiers.FinalDamage *= __DAMAGE__f;
    }
    public override void PostAI(NPC npc) {
        if (!npc.friendly && !npc.townNPC && !npc.boss) {
            npc.velocity *= __SPEED__f;
            if (npc.velocity.Length() > 16f) npc.velocity = Microsoft.Xna.Framework.Vector2.Normalize(npc.velocity) * 16f;
        }
    }
    public override void SetDefaults(NPC npc) {
        if (!npc.friendly && !npc.townNPC) npc.value *= __COINS__f;
    }
}
