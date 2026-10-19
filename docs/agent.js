(function () {
  const input = document.getElementById('files');
  const task = document.getElementById('task');
  const consent = document.getElementById('consent');
  const run = document.getElementById('run');
  const list = document.getElementById('file-list');
  const status = document.getElementById('status');
  const resultCard = document.getElementById('result-card');
  const result = document.getElementById('result');
  const maxTotal = 3 * 1024 * 1024;
  const maxFile = 2 * 1024 * 1024;
  let selected = [];

  function fileError(files) {
    if (!files.length) return 'Choose at least one file.';
    if (files.length > 6) return 'Choose up to 6 files.';
    if (files.some(file => file.size === 0 || file.size > maxFile)) return 'Each file must be non-empty and 2 MB or smaller.';
    if (files.reduce((sum, file) => sum + file.size, 0) > maxTotal) return 'All files together must be 3 MB or smaller.';
    return '';
  }

  function renderFiles() {
    list.replaceChildren();
    if (!selected.length) {
      const li = document.createElement('li'); li.className = 'empty-files'; li.textContent = 'No files selected'; list.append(li);
    }
    selected.forEach(file => {
      const li = document.createElement('li'); li.textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB`; list.append(li);
    });
    const error = fileError(selected);
    if (error) status.textContent = error;
    updateButton();
  }

  function updateButton() { run.disabled = Boolean(fileError(selected)) || !task.value.trim() || !consent.checked || run.dataset.busy === 'true'; }

  function toPayload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(',')[1] });
      reader.readAsDataURL(file);
    });
  }

  input.addEventListener('change', () => { selected = Array.from(input.files || []); renderFiles(); });
  task.addEventListener('input', updateButton);
  consent.addEventListener('change', updateButton);

  run.addEventListener('click', async () => {
    if (run.disabled) return;
    run.dataset.busy = 'true'; updateButton();
    status.textContent = 'Uploading to a temporary workspace…';
    resultCard.hidden = true;
    try {
      const files = await Promise.all(selected.map(toPayload));
      const response = await fetch('/api/opencode-agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: task.value, files, consent: consent.checked }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The agent could not complete this request.');
      result.textContent = data.result;
      resultCard.hidden = false;
      status.textContent = 'Done. Review the notes against the files before using them.';
    } catch (error) {
      status.textContent = error.message || 'Something went wrong. Please try again.';
    } finally {
      run.dataset.busy = 'false'; updateButton();
    }
  });

  document.getElementById('download').addEventListener('click', () => {
    const blob = new Blob([result.textContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'healthspan-research-notes.md'; anchor.click();
    URL.revokeObjectURL(url);
  });
})();
