using System;
using System.Globalization;
using System.Linq;
using PortKit;
using UnityEditor;
using UnityEngine;

namespace RpToolkit
{
    /// <summary>
    /// Play-mode test commands of this game (KitPlayTest.Commands), for altspace/playtest. Typing and the camera's place are
    /// the kit's own now (InputSim `type`, KitProbe `probe - head`); what is left:
    ///   findpos &lt;name&gt;[/&lt;child path&gt;]   the world position of a kit object found by its name anywhere in the scene. An object
    ///                                   attached to a head (the name labels, the fade sphere) is re-parented by the SDK under the
    ///                                   avatar's bone, so KitProbe's path from the kit root no longer reaches it (a kit gap). The
    ///                                   name is percent-coded (%20 a space).
    ///   findtext &lt;name&gt;[/&lt;child path&gt;]  the TextMesh Pro text of an object found the same way
    /// </summary>
    [InitializeOnLoad]
    public static class RpTestCommands
    {
        static Transform FindByName(string[] a, out string whole)
        {
            whole = Uri.UnescapeDataString(string.Join(" ", a));
            int slash = whole.IndexOf('/');
            string name = slash < 0 ? whole : whole.Substring(0, slash);
            string rest = slash < 0 ? null : whole.Substring(slash + 1);
            return UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsInactive.Include, FindObjectsSortMode.None)
                .Where(t => t.name == name && t.gameObject.scene.IsValid())
                .Select(t => rest == null ? t : t.Find(rest))
                .FirstOrDefault(t => t != null);
        }

        static RpTestCommands()
        {
            KitPlayTest.Commands["findtext"] = (a, reply) =>
            {
                var found = a.Length < 1 ? null : FindByName(a, out _);
                var tmp = found != null ? found.GetComponent<TMPro.TMP_Text>() : null;
                reply(tmp == null ? "error: no text" : tmp.text);
                return null;
            };
            KitPlayTest.Commands["findpos"] = (a, reply) =>
            {
                if (a.Length < 1) { reply("error: findpos <name>[/<child path>]"); return null; }
                var found = FindByName(a, out string whole);
                if (found == null) { reply("error: not found " + whole); return null; }
                var p = found.position;
                string parent = found.parent != null ? found.parent.name : "-";
                reply(string.Format(CultureInfo.InvariantCulture, "{0:F3} {1:F3} {2:F3} {3} {4}", p.x, p.y, p.z, found.gameObject.activeInHierarchy ? "on" : "off", parent.Replace(' ', '_')));
                return null;
            };
        }
    }
}
