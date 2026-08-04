import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const SAMPLE = { name: "Sample Lead", company: "Acme Co" };

function render(text) {
  return text.replaceAll("{{name}}", SAMPLE.name).replaceAll("{{company}}", SAMPLE.company);
}

const emptyForm = { name: "", subject: "", body: "" };

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api
      .getTemplates()
      .then((data) => {
        setTemplates(data);
        if (data.length && !selectedId) {
          setSelectedId(data[0]._id);
          setForm(data[0]);
        }
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const select = (t) => {
    setSelectedId(t._id);
    setForm(t);
    setIsNew(false);
  };

  const startNew = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setIsNew(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (isNew) {
        const created = await api.createTemplate(form);
        setIsNew(false);
        setSelectedId(created._id);
      } else {
        await api.updateTemplate(selectedId, form);
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    await api.deleteTemplate(id);
    setSelectedId(null);
    setForm(emptyForm);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Email Templates</h1>
          <p className="text-sm text-slate-500">Reusable sequences with {"{{name}}"} / {"{{company}}"} variables.</p>
        </div>
        <button className="btn-primary" onClick={startNew}>
          + New Template
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card divide-y divide-slate-100 lg:col-span-1">
          {templates.map((t) => (
            <button
              key={t._id}
              onClick={() => select(t)}
              className={`block w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                selectedId === t._id ? "bg-indigo-50" : ""
              }`}
            >
              <p className="font-medium text-slate-900">{t.name}</p>
              <p className="truncate text-slate-500">{t.subject}</p>
            </button>
          ))}
          {templates.length === 0 && <p className="p-4 text-sm text-slate-500">No templates yet.</p>}
        </div>

        <div className="card p-5 lg:col-span-1">
          <form onSubmit={save} className="space-y-3">
            <Field label="Template name">
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Subject">
              <input
                className="input"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                required
              />
            </Field>
            <Field label="Body">
              <textarea
                className="input font-mono"
                rows={12}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                required
              />
            </Field>
            <p className="text-xs text-slate-400">Use {"{{name}}"} and {"{{company}}"} — they get filled in automatically.</p>
            <div className="flex gap-2">
              <button className="btn-primary" type="submit">
                {isNew ? "Create template" : "Save changes"}
              </button>
              {!isNew && selectedId && (
                <button type="button" className="btn-secondary text-red-600" onClick={() => remove(selectedId)}>
                  Delete
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Live Preview</h2>
          <p className="mb-2 text-xs text-slate-400">Rendered for "{SAMPLE.name}" at "{SAMPLE.company}"</p>
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <p className="mb-2 font-medium text-slate-900">{render(form.subject || "")}</p>
            <p className="whitespace-pre-wrap text-slate-700">{render(form.body || "")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
