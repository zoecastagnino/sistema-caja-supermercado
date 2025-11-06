// Utilidades
const $  = (s, c=document)=> c.querySelector(s);
const $$ = (s, c=document)=> Array.from(c.querySelectorAll(s));
const money = (n)=> new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(+n||0);

// LocalStorage
const CATALOG_KEY = 'pos_catalog_v1';
const SALES_KEY   = 'pos_sales_v1';
let catalog = load(CATALOG_KEY) || [];
let sales   = load(SALES_KEY) || [];

// DOM refs
const posBarcode = $('#posBarcode');
const posQty = $('#posQty');
const posAdd = $('#posAdd');
const posAddByName = $('#posAddByName');
const posSearchName = $('#posSearchName');
const posNames = $('#posNames');
const posTableBody = $('#posTable tbody');

const posItems = $('#posItems');
const posSubtotal = $('#posSubtotal');
const posApplyIVA = $('#posApplyIVA');
const posIVA = $('#posIVA');
const posTotal = $('#posTotal');

const posPaymentMethod = $('#posPaymentMethod');
const posPaid = $('#posPaid');
const posChange = $('#posChange');
const posCharge = $('#posCharge');
const posCancel = $('#posCancel');
const posPrint = $('#posPrint');

const btnNewCatalogItem = $('#btnNewCatalogItem');
const btnExportSales = $('#btnExportSales');

const catalogModal = $('#catalogModal');
const catalogForm = $('#catalogForm');
const closeCatalog = $('#closeCatalog');
const catalogTitle = $('#catalogTitle');
const catBarcode = $('#catBarcode');
const catName = $('#catName');
const catPrice = $('#catPrice');
const catTax = $('#catTax');
const catalogId = $('#catalogId');

// Estado
let cart = []; // [{id, barcode, name, price, qty, tax}]
seedIfEmpty();

// ====== Catálogo (simple, sin stock) ======
function seedIfEmpty(){
  if (catalog.length) return updateNameDatalist();
  catalog = [
    { id: crypto.randomUUID(), barcode:'779000000001', name:'Pan x1', price:1200, tax:21 },
    { id: crypto.randomUUID(), barcode:'779000000002', name:'Leche 1L', price:1500, tax:21 },
    { id: crypto.randomUUID(), barcode:'779000000003', name:'Gaseosa 2L', price:2800, tax:21 },
  ];
  save(CATALOG_KEY, catalog);
  updateNameDatalist();
}
function updateNameDatalist(){
  const names = Array.from(new Set(catalog.map(p=>p.name))).sort((a,b)=>a.localeCompare(b,'es'));
  posNames.innerHTML = names.map(n=>`<option value="${escapeHtml(n)}">`).join('');
}

btnNewCatalogItem.addEventListener('click', ()=>{
  openCatalogModal();
});
closeCatalog.addEventListener('click', ()=> catalogModal.close());

catalogForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const data = {
    id: catalogId.value || crypto.randomUUID(),
    barcode: catBarcode.value.trim(),
    name: catName.value.trim(),
    price: Number(catPrice.value||0),
    tax: Number(catTax.value||21)
  };
  if (!data.name) return alert('El nombre es obligatorio.');
  const idx = catalog.findIndex(x=>x.id===data.id);
  if (idx>=0) catalog[idx] = data; else catalog.unshift(data);
  save(CATALOG_KEY, catalog);
  updateNameDatalist();
  catalogModal.close();
});

function openCatalogModal(item){
  catalogTitle.textContent = item ? 'Editar producto' : 'Nuevo producto (catálogo)';
  catalogId.value = item?.id||'';
  catBarcode.value = item?.barcode||'';
  catName.value = item?.name||'';
  catPrice.value = item?.price||'';
  catTax.value = item?.tax??21;
  catalogModal.showModal();
  setTimeout(()=> catName.focus(), 50);
}

// ====== Carrito ======
function renderCart(){
  posTableBody.innerHTML = cart.map((it, idx)=>{
    const subtotal = it.price * it.qty;
    return `<tr data-idx="${idx}">
      <td>
        ${escapeHtml(it.name)}
        <div class="muted">${escapeHtml(it.barcode||'')} · IVA ${it.tax}%</div>
      </td>
      <td class="num"><input class="price-input" type="number" step="0.01" min="0" value="${it.price}"></td>
      <td class="num"><input class="qty-input" type="number" min="1" step="1" value="${it.qty}"></td>
      <td class="num">${money(subtotal)}</td>
      <td>
        <button class="icon-btn" data-act="editCat" title="Editar en catálogo">✏️</button>
        <button class="icon-btn danger" data-act="remove" title="Quitar">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  const subtotal = cart.reduce((a,i)=> a + i.price*i.qty, 0);
  // IVA por ítem si checkbox está activo; si no, 0
  const iva = posApplyIVA.checked
    ? cart.reduce((a,i)=> a + (i.price*i.qty) * (i.tax/100), 0)
    : 0;
  const total = subtotal + iva;

  posItems.textContent = cart.reduce((a,i)=> a + i.qty, 0);
  posSubtotal.textContent = money(subtotal);
  posIVA.textContent = money(iva);
  posTotal.textContent = money(total);

  const paid = Number(posPaid.value||0);
  posChange.textContent = money(Math.max(0, paid - total));
}

function addToCartByBarcode(barcode, qty=1){
  const prod = findByBarcode(barcode);
  if (!prod) return askQuickCreate(barcode);
  addToCart(prod, qty);
}
function addToCartByName(name, qty=1){
  const prod = catalog.find(p => (p.name||'').toLowerCase() === name.trim().toLowerCase());
  if (!prod) return alert('No existe en catálogo. Usá "Agregar al catálogo" para crearlo.');
  addToCart(prod, qty);
}
function addToCart(prod, qty=1){
  qty = Number(qty||1); if (qty<=0) qty = 1;
  const i = cart.findIndex(x=>x.id===prod.id);
  if (i>=0) cart[i].qty += qty;
  else cart.push({ id: prod.id, barcode: prod.barcode, name: prod.name, price: Number(prod.price||0), qty, tax: Number(prod.tax||21) });
  renderCart();
  posBarcode.value = ''; posQty.value = 1; posSearchName.value = '';
  posBarcode.focus();
}

function findByBarcode(barcode){
  return catalog.find(p => (p.barcode||'').toString() === (barcode||'').toString());
}

function askQuickCreate(barcode){
  if (!confirm('No existe en catálogo. ¿Querés crearlo ahora?')) return;
  openCatalogModal({ barcode, name:'', price:'', tax:21 });
}

// Eventos carrito
posAdd.addEventListener('click', ()=>{
  if (!posBarcode.value.trim()) return;
  addToCartByBarcode(posBarcode.value.trim(), Number(posQty.value||1));
});
posAddByName.addEventListener('click', ()=>{
  if (!posSearchName.value.trim()) return;
  addToCartByName(posSearchName.value.trim(), Number(posQty.value||1));
});
posBarcode.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter'){
    e.preventDefault();
    if (posBarcode.value.trim()) addToCartByBarcode(posBarcode.value.trim(), Number(posQty.value||1));
  }
});

posTableBody.addEventListener('input', (e)=>{
  const tr = e.target.closest('tr'); if (!tr) return;
  const idx = +tr.dataset.idx;
  if (e.target.classList.contains('qty-input')){
    const v = Math.max(1, Number(e.target.value||1));
    cart[idx].qty = v;
  }
  if (e.target.classList.contains('price-input')){
    const v = Math.max(0, Number(e.target.value||0));
    cart[idx].price = v;
  }
  renderCart();
});
posTableBody.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const tr = e.target.closest('tr'); const idx = +tr.dataset.idx;
  const act = btn.dataset.act;
  if (act==='remove'){ cart.splice(idx,1); renderCart(); }
  if (act==='editCat'){
    const it = cart[idx];
    const prod = catalog.find(p=>p.id===it.id);
    openCatalogModal(prod);
  }
});

[posApplyIVA, posPaid].forEach(el => el.addEventListener('input', renderCart));

document.addEventListener('keydown', (e)=>{
  if (e.key==='F2'){ e.preventDefault(); cobrar(); }
});

posCharge.addEventListener('click', cobrar);
posCancel.addEventListener('click', ()=>{
  if (!cart.length) return;
  if (confirm('¿Cancelar y vaciar carrito?')){ cart = []; renderCart(); }
});

btnExportSales.addEventListener('click', exportSalesCSV);

// Cobro
function cobrar(){
  if (!cart.length) return alert('El carrito está vacío.');
  const subtotal = cart.reduce((a,i)=> a + i.price*i.qty, 0);
  const iva = posApplyIVA.checked
    ? cart.reduce((a,i)=> a + (i.price*i.qty)*(i.tax/100), 0)
    : 0;
  const total = subtotal + iva;

  const paid = Number(posPaid.value||0);
  if (posPaymentMethod.value==='efectivo' && paid < total){
    return alert('El importe recibido es menor al total.');
  }

  const sale = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    items: cart.map(i=>({ id:i.id, name:i.name, barcode:i.barcode, price:i.price, qty:i.qty, tax:i.tax })),
    subtotal, iva, total, paid, method: posPaymentMethod.value
  };
  sales.unshift(sale);
  save(SALES_KEY, sales);

  if (posPrint.checked) printTicket(sale);

  cart = [];
  posPaid.value = 0;
  renderCart();
  alert('Venta registrada.');
}

function printTicket(sale){
  const w = window.open('', '_blank');
  const fecha = new Date(sale.date);
  const lines = sale.items.map(i => `
    <tr>
      <td>${escapeHtml(i.name)}<br><span style="color:#666;font-size:12px">${escapeHtml(i.barcode||'')}</span></td>
      <td style="text-align:right">${money(i.price)}</td>
      <td style="text-align:right">${i.qty}</td>
      <td style="text-align:right">${money(i.price*i.qty)}</td>
    </tr>
  `).join('');

  w.document.write(`
    <html><head><title>Ticket</title>
      <meta charset="utf-8" />
      <style>
        body{font-family:ui-sans-serif,system-ui; margin:20px; color:#111}
        h1{font-size:18px; margin:0 0 6px}
        .muted{color:#666; font-size:12px}
        table{width:100%; border-collapse:collapse; margin-top:10px}
        th,td{border-bottom:1px solid #eee; padding:6px}
        th{text-align:left; font-size:12px; color:#444}
        .right{float:right}
      </style>
    </head><body>
      <h1>Ticket</h1>
      <div class="muted">${fecha.toLocaleString('es-AR')}</div>
      <table>
        <thead><tr><th>Producto</th><th style="text-align:right">Precio</th><th style="text-align:right">Cant.</th><th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>${lines}</tbody>
      </table>
      <div style="margin-top:10px">
        <div><strong>Subtotal:</strong> <span class="right">${money(sale.subtotal)}</span></div>
        <div><strong>IVA:</strong> <span class="right">${money(sale.iva)}</span></div>
        <div><strong>Total:</strong> <span class="right">${money(sale.total)}</span></div>
        <div><strong>Pagó (${sale.method}):</strong> <span class="right">${money(sale.paid)}</span></div>
        <div><strong>Vuelto:</strong> <span class="right">${money(Math.max(0, sale.paid - sale.total))}</span></div>
      </div>
      <p class="muted">¡Gracias por su compra!</p>
      <script>window.print()</script>
    </body></html>
  `);
  w.document.close();
}

// Helpers
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function load(key){ try{ return JSON.parse(localStorage.getItem(key)); }catch{ return null; } }
function escapeHtml(s=''){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// Exportar ventas
function exportSalesCSV(){
  if (!sales.length) return alert('No hay ventas para exportar.');
  const headers = ['id','fecha','medio','items','subtotal','iva','total','pagado'];
  const rows = [headers.join(',')].concat(
    sales.map(s=>{
      const itemsTxt = s.items.map(i=>`${i.name} x${i.qty} @ ${i.price}`).join(' | ').replace(/"/g,'""');
      const vals = [
        s.id,
        new Date(s.date).toLocaleString('es-AR'),
        s.method,
        `"${itemsTxt}"`,
        s.subtotal.toFixed(2),
        s.iva.toFixed(2),
        s.total.toFixed(2),
        s.paid.toFixed(2)
      ];
      return vals.join(',');
    })
  );
  const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ventas_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Init
updateNameDatalist();
renderCart();