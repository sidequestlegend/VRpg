using System;
using System.Collections;
using System.Globalization;
using System.Linq;
using PortKit;
using TMPro;
using UnityEditor;
using UnityEngine;

namespace RpToolkit
{
    /// <summary>
    /// Play-mode test commands of this game (KitPlayTest.Commands), for altspace/playtest:
    ///   type &lt;holder&gt; &lt;path&gt; &lt;text&gt;   key presses into the TMP_InputField at path: each character goes through the field's own
    ///                                   key handling (TMP_InputField.ProcessEvent, as uGUI's input module hands it a key event). The
    ///                                   test clicks the field with the mouse first (focus) and clicks elsewhere after (the field is
    ///                                   left), as a person does. Text is percent-coded (%20 a space, %25 a percent sign).
    ///   where                         the desktop player's camera (the local head) in world space
    /// The test's own mouse and keyboard (InputSim) cannot type: TMP_InputField reads characters from IMGUI events, which
    /// the Input System's state events do not make.
    /// </summary>
    [InitializeOnLoad]
    public static class RpTestCommands
    {
        static RpTestCommands()
        {
            KitPlayTest.Commands["type"] = Type;
            KitPlayTest.Commands["where"] = (a, reply) =>
            {
                var cam = Camera.main != null ? Camera.main : UnityEngine.Object.FindObjectsByType<Camera>(FindObjectsSortMode.None).FirstOrDefault(c => c.isActiveAndEnabled);
                if (cam == null) { reply("error: no camera"); return null; }
                var p = cam.transform.position;
                reply(string.Format(CultureInfo.InvariantCulture, "{0:F3} {1:F3} {2:F3}", p.x, p.y, p.z));
                return null;
            };
        }

        static IEnumerator Type(string[] a, Action<string> reply)
        {
            if (a.Length < 3) { reply("error: type <holder> <path> <text>"); yield break; }
            var t = KitProbe.Find(a[0], a[1]);
            var field = t != null ? t.GetComponent<TMP_InputField>() : null;
            if (field == null) { reply("error: no input field at " + a[1]); yield break; }
            bool focused = field.isFocused;
            string text = Uri.UnescapeDataString(string.Join(" ", a.Skip(2)));
            foreach (char c in text)
            {
                field.ProcessEvent(new Event { type = EventType.KeyDown, character = c, keyCode = KeyCode.None });
                yield return null;
            }
            field.ForceLabelUpdate();
            reply($"ok typed {text.Length}, focused before {focused}, now '{field.text}'");
        }
    }
}
