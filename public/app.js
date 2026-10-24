const categories = ['docentes', 'tecnicos', 'terceirizados'];
const labels = { docentes: 'Docentes', tecnicos: 'Técnicos', terceirizados: 'Terceirizados' };
let people = [];
let filter = 'todos';
let showMarkedOnly = false;
let undoAction = null;
let selectedCategory = 'docentes';
let busy = false;
const $ = (selector) => document.querySelector(selector);
const login = $('#login');
const app = $('#app');
const status = $('#status');
const storageKey = 'checklist-servidores-sga-access';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionStorage.getItem(storageKey) || ''}`, ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    sessionStorage.removeItem(storageKey);
    app.classList.add('hidden'); login.classList.remove('hidden');
    throw new Error('Senha incorreta ou sessão expirada. Digite a senha novamente.');
  }
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}

async function loadRoster(silent = false) {
  try {
    const rows = await api('/api/servidores');
    people = rows;
    render();
    status.textContent = 'Sincronizado com o banco de dados';
  } catch (error) {
    status.textContent = error.message;
    if (!silent) alert(error.message);
  }
}

function render() {
  const lists = $('#lists');
  lists.replaceChildren();
  const scopedCategories = filter === 'todos' ? categories : [filter];
  const scopedPeople = people.filter(person => scopedCategories.includes(person.categoria));
  let visible = 0;
  const marked = scopedPeople.filter(person => person.marcado).length;
  for (const category of scopedCategories) {
    const entries = people.filter(person => person.categoria === category);
    if (!entries.length) continue;
    const displayedEntries = showMarkedOnly ? entries.filter(person => person.marcado) : entries;
    if (!displayedEntries.length) continue;
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.className = 'group-title';
    const checkedCount = entries.filter(person => person.marcado).length;
    heading.textContent = `${labels[category]} · ${checkedCount} de ${entries.length} marcados`;
    section.append(heading);
    const list = document.createElement('div');
    list.className = 'list';
    const unchecked = showMarkedOnly ? [] : entries.filter(person => !person.marcado);
    const checked = entries.filter(person => person.marcado);
    for (const [index, person] of [...unchecked, ...checked].entries()) {
      if (index === unchecked.length && checked.length && unchecked.length) {
        const divider = document.createElement('hr'); divider.className = 'selection-divider'; divider.setAttribute('aria-hidden', 'true'); list.append(divider);
      }
      visible++;
      const row = document.createElement('label'); row.className = 'item';
      const box = document.createElement('input'); box.type = 'checkbox'; box.checked = person.marcado;
      box.addEventListener('change', async () => {
        const prior = { marcado: person.marcado, marcado_em: person.marcado_em };
        busy = true; box.disabled = true;
        try {
          await api(`/api/servidores/${person.id}`, { method: 'PATCH', body: JSON.stringify({ marcado: box.checked }) });
          undoAction = async () => {
            await api(`/api/servidores/${person.id}`, { method: 'PATCH', body: JSON.stringify({ marcado: prior.marcado, marcado_em: prior.marcado_em }) });
            await loadRoster(true);
          };
          $('#undo').disabled = false;
          await loadRoster(true);
        } catch (error) { alert(error.message); }
        finally { busy = false; }
      });
      const name = document.createElement('span'); name.className = 'name'; name.textContent = person.nome;
      row.append(box, name); list.append(row);
    }
    section.append(list); lists.append(section);
  }
  if (!visible) lists.innerHTML = `<div class="empty">${showMarkedOnly ? 'Nenhum servidor marcado nesta categoria.' : 'Nenhum servidor nesta categoria.'}</div>`;
  $('#total').textContent = `${visible} / ${scopedPeople.length}`;
  $('#done').textContent = String(marked).padStart(2, '0');
  $('#marked-toggle').setAttribute('aria-pressed', String(showMarkedOnly));
  $('#marked-toggle').setAttribute('aria-label', showMarkedOnly ? 'Mostrar todos os servidores' : 'Mostrar apenas servidores marcados');
  $('#marked-toggle').title = showMarkedOnly ? 'Mostrar todos' : 'Mostrar apenas os marcados';
  status.textContent = `${people.length} servidores · sincronização automática`;
}

async function enter(password) {
  sessionStorage.setItem(storageKey, password);
  try {
    await api('/api/validar', { method: 'POST', body: '{}' });
    login.classList.add('hidden'); app.classList.remove('hidden');
    $('#login-error').textContent = '';
    await loadRoster();
  } catch (error) {
    sessionStorage.removeItem(storageKey);
    $('#login-error').textContent = error.message;
  }
}

$('#login-form').addEventListener('submit', event => {
  event.preventDefault(); enter($('#password').value);
});
$('#logout').addEventListener('click', () => {
  sessionStorage.removeItem(storageKey); app.classList.add('hidden'); login.classList.remove('hidden'); $('#password').value = '';
});
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('.tab').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  render();
}));
$('#marked-toggle').addEventListener('click', () => {
  showMarkedOnly = !showMarkedOnly;
  render();
});

const dialog = $('#dialog');
document.querySelectorAll('.category-choice').forEach(button => button.addEventListener('click', () => {
  selectedCategory = button.dataset.category;
  document.querySelectorAll('.category-choice').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
$('#add').addEventListener('click', () => { selectedCategory = 'docentes'; document.querySelectorAll('.category-choice').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.category === selectedCategory))); dialog.showModal(); });
$('#cancel').addEventListener('click', () => dialog.close());
$('#add-form').addEventListener('submit', async event => {
  event.preventDefault();
  const nome = $('#person-name').value.trim();
  try {
    await api('/api/servidores', { method: 'POST', body: JSON.stringify({ nome, categoria: selectedCategory }) });
    dialog.close(); event.target.reset(); filter = selectedCategory; showMarkedOnly = false;
    document.querySelectorAll('.tab').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.filter === filter)));
    await loadRoster(true);
    const added = people.find(person => person.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR') && person.categoria === selectedCategory);
    undoAction = added ? async () => { await api(`/api/servidores/${added.id}`, { method: 'DELETE' }); await loadRoster(true); } : null;
    $('#undo').disabled = false;
  } catch (error) { alert(error.message); }
});

$('#undo').addEventListener('click', async () => {
  if (!undoAction) return;
  const action = undoAction; undoAction = null; $('#undo').disabled = true;
  try { await action(); } catch (error) { alert(error.message); }
});

function escapeCsv(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
$('#export').addEventListener('click', () => {
  const content = '\uFEFFNome;Categoria;Marcado;Data e hora\r\n' + people.map(person => [person.nome, labels[person.categoria], person.marcado ? 'Sim' : 'Não', person.marcado_em ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(person.marcado_em)) : ''].map(escapeCsv).join(';')).join('\r\n');
  download(content, 'checklist-servidores.csv', 'text/csv;charset=utf-8');
});

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const importDialog = $('#import-dialog');
$('#import').addEventListener('click', () => importDialog.showModal());
$('#close-import').addEventListener('click', () => importDialog.close());
$('#template-download').addEventListener('click', () => download('\uFEFFNome;Categoria\r\n;\r\n', 'modelo_importacao_servidores.csv', 'text/csv;charset=utf-8'));
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
    if (rows.length < 2) throw new Error('Preencha pelo menos uma pessoa no arquivo.');
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const header = rows[0].map(normalize); const nameIndex = header.indexOf('nome'); const categoryIndex = header.indexOf('categoria');
    if (nameIndex < 0 || categoryIndex < 0) throw new Error('O CSV precisa ter as colunas Nome e Categoria.');
    const map = { docente: 'docentes', docentes: 'docentes', tecnico: 'tecnicos', tecnicos: 'tecnicos', terceirizado: 'terceirizados', terceirizados: 'terceirizados' };
    let inserted = 0;
    for (const row of rows.slice(1)) {
      const nome = (row[nameIndex] || '').trim(); const categoria = map[normalize(row[categoryIndex] || '')];
      if (!nome && !categoria) continue;
      if (!nome || !categoria) throw new Error('Cada linha precisa ter nome e categoria válidos.');
      try { await api('/api/servidores', { method: 'POST', body: JSON.stringify({ nome, categoria }) }); inserted++; }
      catch (error) { if (!error.message.includes('Já existe')) throw error; }
    }
    importDialog.close(); await loadRoster(true); alert(`${inserted} registro(s) novo(s) enviados ao banco. Nomes que já existiam foram ignorados.`);
  } catch (error) { alert(error.message); }
  event.target.value = '';
});

function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (char === ';' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(field); if (row.some(value => value.trim())) rows.push(row); row = []; field = ''; }
    else field += char;
  }
  row.push(field); if (row.some(value => value.trim())) rows.push(row); return rows;
}

$('#print').addEventListener('click', () => {
  const report = $('#print-summary'); report.replaceChildren();
  const heading = document.createElement('h1'); heading.textContent = 'Checklist de Servidores'; report.append(heading);
  const date = document.createElement('p'); date.className = 'print-date'; date.textContent = `Emitido em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`; report.append(date);
  for (const category of categories) {
    const records = people.filter(person => person.categoria === category); const checked = records.filter(person => person.marcado);
    const section = document.createElement('section'); const h2 = document.createElement('h2'); h2.textContent = labels[category]; section.append(h2);
    const count = document.createElement('p'); count.textContent = `Marcados: ${checked.length} de ${records.length}`; section.append(count);
    const list = document.createElement('ul');
    for (const person of checked) { const li = document.createElement('li'); li.append(document.createTextNode(person.nome)); const stamp = document.createElement('small'); stamp.textContent = person.marcado_em ? ` — Marcado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(person.marcado_em))}` : ' — Data/hora não registrada'; li.append(stamp); list.append(li); }
    if (checked.length) section.append(list); else { const none = document.createElement('p'); none.textContent = 'Nenhum servidor marcado.'; section.append(none); }
    report.append(section);
  }
  document.body.dataset.printing = 'true';
  const done = () => { delete document.body.dataset.printing; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); window.print();
});

const themeKey = 'checklist-servidores-sga-theme-v1';
let theme = { mode: 'light', color: '#0f766e' };
try { theme = { ...theme, ...JSON.parse(localStorage.getItem(themeKey) || '{}') }; } catch {}
function applyTheme() {
  document.body.dataset.mode = theme.mode; document.documentElement.style.setProperty('--accent', theme.color);
  $('meta[name="theme-color"]').content = theme.color; localStorage.setItem(themeKey, JSON.stringify(theme));
  $('#light-mode').setAttribute('aria-pressed', String(theme.mode === 'light')); $('#dark-mode').setAttribute('aria-pressed', String(theme.mode === 'dark'));
}
$('#light-mode').addEventListener('click', () => { theme.mode = 'light'; applyTheme(); });
$('#dark-mode').addEventListener('click', () => { theme.mode = 'dark'; applyTheme(); });
const palette = $('#palette'); const paletteToggle = $('#palette-toggle');
paletteToggle.addEventListener('click', () => { palette.classList.toggle('open'); paletteToggle.setAttribute('aria-expanded', String(palette.classList.contains('open'))); });
document.querySelectorAll('#palette [data-color]').forEach(button => button.addEventListener('click', () => { theme.color = button.dataset.color; theme.mode = 'color'; applyTheme(); palette.classList.remove('open'); paletteToggle.setAttribute('aria-expanded', 'false'); }));
$('#custom-color').addEventListener('input', event => { theme.color = event.target.value; theme.mode = 'color'; applyTheme(); });
applyTheme();

const savedPassword = sessionStorage.getItem(storageKey);
if (savedPassword) enter(savedPassword);
setInterval(() => { if (!app.classList.contains('hidden')) loadRoster(true); }, 12000);

