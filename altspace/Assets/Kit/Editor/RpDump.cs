using System.IO;
using System.Linq;
using System.Text;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;
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

        /// <summary>
        /// The kit's photo (Library/PortKit/kits/photos/rp-toolkit.jpg, which Export Artifacts takes) framed on the menu board: the
        /// generic PortKit/Kit/Take Photos frames every renderer, and the floor grid (20 m) and the label pool would fill it.
        /// Also Logs/rp_layout.jpg, larger, for checking the layout. Run it after PortKit/Kit/Take Photos.
        /// </summary>
        [MenuItem("PortKit/RpToolkit/Take Menu Photo")]
        public static void Photo()
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Kit/rp-toolkit.prefab");
            var scene = EditorSceneManager.NewPreviewScene();
            try
            {
                var copy = Object.Instantiate(prefab);
                SceneManager.MoveGameObjectToScene(copy, scene);
                foreach (var t in copy.GetComponentsInChildren<Transform>(true))
                    if (t.name == "Labels" || t.name == "GridPlane" || t.name == "FadeTarget" || t.name.StartsWith("Panel ") && t.name != "Panel 0 - Main"
                        || t.name == "Dice d20" || t.name == "OperUI") t.gameObject.SetActive(false);
                var canvas = copy.GetComponentsInChildren<Canvas>(true).First(c => c.name == "Menu Canvas");
                var corners = new Vector3[4];
                ((RectTransform)canvas.transform).GetWorldCorners(corners);
                var centre = (corners[0] + corners[2]) / 2f;
                float width = Vector3.Distance(corners[0], corners[3]);
                Canvas.ForceUpdateCanvases();
                foreach (var (path, w, h, scale) in new[] { ("Library/PortKit/kits/photos/rp-toolkit.jpg", 1024, 768, 1.0f), ("Logs/rp_layout.jpg", 2000, 1600, 1.0f) })
                {
                    var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB) { antiAliasing = 8 };
                    var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
                    var camObject = new GameObject("Camera");
                    SceneManager.MoveGameObjectToScene(camObject, scene);
                    var cam = camObject.AddComponent<Camera>();
                    cam.scene = scene;
                    cam.fieldOfView = 40f;
                    cam.clearFlags = CameraClearFlags.SolidColor;
                    cam.backgroundColor = new Color(0.16f, 0.18f, 0.22f);
                    float reach = width * 0.62f / Mathf.Tan(20f * Mathf.Deg2Rad) * scale;
                    cam.transform.position = centre - canvas.transform.forward * reach;
                    cam.transform.rotation = Quaternion.LookRotation(canvas.transform.forward, canvas.transform.up);
                    cam.nearClipPlane = 0.02f;
                    cam.targetTexture = rt;
                    canvas.worldCamera = cam;
                    cam.Render();
                    RenderTexture.active = rt;
                    tex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
                    tex.Apply();
                    RenderTexture.active = null;
                    cam.targetTexture = null;
                    Directory.CreateDirectory(Path.GetDirectoryName(path));
                    File.WriteAllBytes(path, tex.EncodeToJPG(90));
                    rt.Release();
                    Object.DestroyImmediate(rt);
                    Object.DestroyImmediate(tex);
                    Object.DestroyImmediate(camObject);
                }
                File.WriteAllText("Logs/rp_photo.txt", "DONE\n");
            }
            finally { EditorSceneManager.ClosePreviewScene(scene); }
        }

        static string Short(string s) { s = (s ?? "").Replace("\n", "\\n"); return s.Length > 80 ? s.Substring(0, 80) + "..." : s; }
    }
}
