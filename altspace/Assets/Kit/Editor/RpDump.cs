using System.IO;
using System.Linq;
using System.Text;
using TMPro;
using UnityEditor;
using UnityEngine;

namespace RpToolkit
{
    /// <summary>Writes the imported upstream prefabs' hierarchies to Logs/rp_dump_*.txt (what the kit builder works from).</summary>
    public static class RpDump
    {
        [MenuItem("PortKit/RpToolkit/Dump Upstream Prefabs")]
        public static void Dump()
        {
            foreach (var (name, path) in new[]
            {
                ("manager", RpToolkitKitBuilder.ManagerPrefab), ("player", RpToolkitKitBuilder.PlayerPrefab), ("dice5e", RpToolkitKitBuilder.Dice5EPrefab),
                ("fade", RpToolkitKitBuilder.FadePrefab),
            })
            {
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                var text = new StringBuilder();
                if (prefab == null) text.AppendLine("no prefab at " + path);
                else Walk(prefab.transform, 0, text);
                Directory.CreateDirectory("Logs");
                File.WriteAllText($"Logs/rp_dump_{name}.txt", text.ToString());
            }
        }

        static void Walk(Transform t, int depth, StringBuilder text)
        {
            string pad = new string(' ', depth * 2);
            var comps = t.GetComponents<Component>().Select(c => c == null ? "MISSING" : c.GetType().Name).Where(n => n != "Transform" && n != "RectTransform" && n != "CanvasRenderer");
            string rect = t is RectTransform r ? $" rect={r.rect.width:0.#}x{r.rect.height:0.#} ap={r.anchoredPosition.x:0.#},{r.anchoredPosition.y:0.#} amin={r.anchorMin.x:0.##},{r.anchorMin.y:0.##} amax={r.anchorMax.x:0.##},{r.anchorMax.y:0.##} piv={r.pivot.x:0.##},{r.pivot.y:0.##}" : "";
            text.AppendLine($"{pad}{t.name} [{(t.gameObject.activeSelf ? "on" : "off")} L{t.gameObject.layer}] p={t.localPosition:F3} r={t.localEulerAngles:F1} s={t.localScale:F3}{rect} :: {string.Join(", ", comps)}");
            foreach (var c in t.GetComponents<Component>())
            {
                if (c is TMP_Text tmp) text.AppendLine($"{pad}    tmp '{Short(tmp.text)}' size {tmp.fontSize} font {(tmp.font ? tmp.font.name : "null")} mat {(tmp.fontSharedMaterial ? tmp.fontSharedMaterial.name : "null")} color {tmp.color} align {tmp.alignment} rich {tmp.richText}");
                if (c is UnityEngine.UI.Text ui) text.AppendLine($"{pad}    text '{Short(ui.text)}' size {ui.fontSize} font {(ui.font ? ui.font.name : "null")}");
                if (c is UnityEngine.UI.Image img) text.AppendLine($"{pad}    image sprite {(img.sprite ? img.sprite.name : "null")} mat {(img.material ? img.material.name : "null")} color {img.color} type {img.type}");
                if (c is UnityEngine.UI.Button b)
                    for (int i = 0; i < b.onClick.GetPersistentEventCount(); i++)
                        text.AppendLine($"{pad}    onClick {(b.onClick.GetPersistentTarget(i) ? b.onClick.GetPersistentTarget(i).name + ":" + b.onClick.GetPersistentTarget(i).GetType().Name : "null")}.{b.onClick.GetPersistentMethodName(i)}");
                if (c is UnityEngine.UI.Toggle tg) text.AppendLine($"{pad}    toggle isOn {tg.isOn} graphic {(tg.graphic ? tg.graphic.name : "null")} events {tg.onValueChanged.GetPersistentEventCount()}");
                if (c is TMP_InputField f) text.AppendLine($"{pad}    field text '{f.text}' textComponent {(f.textComponent ? f.textComponent.name : "null")} placeholder {(f.placeholder ? f.placeholder.name : "null")} line {f.lineType} limit {f.characterLimit}");
                if (c is TMP_Dropdown d) text.AppendLine($"{pad}    dropdown options {string.Join("/", d.options.Select(o => o.text))}");
                if (c is Canvas cv) text.AppendLine($"{pad}    canvas mode {cv.renderMode} sort {cv.sortingOrder}");
                if (c is Renderer re) text.AppendLine($"{pad}    materials {string.Join(", ", re.sharedMaterials.Select(m => m ? m.name + "(" + m.shader.name + ")" : "null"))}");
                if (c is MeshFilter mf) text.AppendLine($"{pad}    mesh {(mf.sharedMesh ? mf.sharedMesh.name : "null")}");
                if (c is AudioSource au) text.AppendLine($"{pad}    audio clip {(au.clip ? au.clip.name : "null")} vol {au.volume}");
                if (c is Animator an) text.AppendLine($"{pad}    animator {(an.runtimeAnimatorController ? an.runtimeAnimatorController.name : "null")}");
                if (c is UnityEngine.UI.ScrollRect sr) text.AppendLine($"{pad}    scroll content {(sr.content ? sr.content.name : "null")} viewport {(sr.viewport ? sr.viewport.name : "null")}");
                if (c is UnityEngine.UI.GridLayoutGroup gl) text.AppendLine($"{pad}    grid cell {gl.cellSize} spacing {gl.spacing}");
            }
            foreach (Transform child in t) Walk(child, depth + 1, text);
        }

        static string Short(string s) { s = (s ?? "").Replace("\n", "\\n"); return s.Length > 80 ? s.Substring(0, 80) + "..." : s; }
    }
}
