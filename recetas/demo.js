'use strict';
const DATA=window.RECETAS_DEMO,$=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='recetas-public-demo-v1';
const defaults=()=>({plan:{},home:[...DATA.pantry],notes:{},cart:{},extras:[],choices:{},skipped:[],optional:{},cartQty:{},purchaseUnits:{},cartBuilt:false});
let state=defaults(),current=0,page=0,view='recipes',cartMessage='';
try {
  const saved=JSON.parse(localStorage.getItem(KEY));
  if(saved&&saved.plan&&Array.isArray(saved.home)&&saved.cart&&saved.notes) {
    state={...defaults(),...saved};
    state.cartBuilt=!!saved.cartBuilt||Object.keys(saved.cart).length>0;
  }
} catch {}
const isHome=id=>state.home.includes(id);
const planned=()=>DATA.recipes.filter(r=>state.plan[r.id]);
const cartCount=()=>Object.values(state.cart).reduce((n,x)=>n+x.qty,0);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}
  $('planCount').textContent=planned().length;
  $('cartCount').textContent=cartCount();
}
let noticeTimer;
function notify(text){$('notice').textContent=text;$('notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('show'),2500);}
function icon(s){
  for(const [re,e] of [[/chocolate/,'🍫'],[/pomegranate/,'🔴'],[/taco|chicken/,'🌮'],[/crepe|crêpe/,'🥞'],[/carrot|pastanaga/,'🥕'],[/honey/,'🍯'],[/yogurt|milk|cream|half/,'🥛'],[/orange/,'🍊'],[/(^| )salt( |$)/,'🧂'],[/olive|oil/,'🫒'],[/pistach|nut/,'🥜'],[/lime|lemon/,'🍋'],[/avocado/,'🥑'],[/banana/,'🍌'],[/strawberr/,'🍓'],[/blueberr/,'🫐'],[/onion/,'🧅'],[/garlic/,'🧄'],[/pepper|chipotle/,'🌶️'],[/bean/,'🫘'],[/egg/,'🥚'],[/potato/,'🥔'],[/butter/,'🧈'],[/flour/,'🌾']])if(re.test(s.toLowerCase()))return e;
  return '🥣';
}
function amount(n){if(n==null)return 'To taste';const v=Math.round(n*100)/100;return ({0.25:'¼',0.5:'½',0.75:'¾',0.33:'⅓',0.67:'⅔',1.5:'1½'})[v]||String(v);}
function grocery(){
  const rows=new Map();
  for(const r of planned())for(const i of r.ingredients){
    if(i.optional&&!state.optional[r.id])continue;
    const key=i.id+'|'+(i.unit||'');
    if(!rows.has(key))rows.set(key,{...i,key,quantity:0,unknown:false,recipes:[],batches:0});
    const row=rows.get(key);row.unknown ||= i.quantity==null;
    row.quantity+=(i.quantity_max??i.quantity??0)*state.plan[r.id];
    row.batches+=state.plan[r.id];row.recipes.push(r.title);
  }
  return [...rows.values()];
}
const groups=()=>{
  const all=grocery(),home=new Map();
  for(const i of all.filter(i=>isHome(i.id))){
    const prior=home.get(i.id);
    home.set(i.id,{...i,name:prior?.name||i.name,recipes:[...new Set([...(prior?.recipes||[]),...i.recipes])]});
  }
  return {all,buy:all.filter(i=>!isHome(i.id)&&!state.skipped.includes(i.id)),home:[...home.values()],skip:all.filter(i=>!isHome(i.id)&&state.skipped.includes(i.id))};
};
function requiredCart(){
  const required={};
  for(const i of groups().buy){
    const product=DATA.products[i.id],key=product?.key||i.id;
    const qty=product?.capacity&&product.unit===i.unit&&!i.unknown?Math.max(1,Math.ceil(i.quantity/product.capacity)):Math.ceil((product?.qty||1)*i.batches);
    const prior=required[key];
    required[key]={baseName:product?.name||i.name,name:state.choices[key]||product?.name||i.name,qty:Math.max(prior?.qty||0,qty),known:!!product||!!state.choices[key],price:product?.price??3.99,ingredients:[...new Set([...(prior?.ingredients||[]),i.id])],sources:[...new Set([...(prior?.sources||[]),...i.recipes])],kind:'recipe'};
  }
  for(const n of state.extras){const x=DATA.extras[n];if(x)required['extra-'+n]={baseName:x.product,name:state.choices['extra-'+n]||x.product,qty:1,known:true,price:x.price??3.99,ingredients:[],sources:['Household extra'],kind:'extra'};}
  for(const [id,x] of Object.entries(required))if(state.cartQty[id])x.qty=state.cartQty[id];
  return required;
}
function syncCart(){if(state.cartBuilt)state.cart=requiredCart();}
function changed(){syncCart();save();render();}
function toggleHome(id){state.home=isHome(id)?state.home.filter(x=>x!==id):[...state.home,id];changed();}
function go(next){
  view=['recipes','shopping','pantry','cart'].includes(next)?next:'recipes';
  ['recipes','shopping','pantry','cart'].forEach(id=>$(id).hidden=id!==view);
  document.querySelectorAll('nav [data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  history.replaceState(null,'','#'+view);render();window.scrollTo({top:0,behavior:'instant'});
}
function steps(active){return `<nav class="shopping-steps" aria-label="Shopping steps"><button data-view="recipes" ${active===1?'aria-current="step"':''}><b>${active>1?'✓':'1'}</b> Pick recipes</button><button data-view="shopping" ${active===2?'aria-current="step"':''}><b>${active>2?'✓':'2'}</b> Check kitchen</button><button data-view="cart" ${active===3?'aria-current="step"':''}><b>3</b> Shop with Instacart</button></nav>`;}
function renderDock(){
  const g=groups(),show=planned().length||state.extras.length||cartCount();
  $('planDock').hidden=!show;document.body.classList.toggle('has-plan',!!show);
  if(!show)return;
  const action=view==='cart'?(cartCount()?'<button data-checkout class="primary">Review checkout →</button>':'<button data-view="shopping" class="primary">Edit shopping list →</button>'):view==='shopping'?'<button data-build class="primary">'+(state.cartBuilt?'Update Family Cart':'Add to Family Cart')+' →</button>':'<button data-view="shopping" class="primary">Check kitchen →</button>';
  $('planDock').innerHTML=`<div><strong>${planned().length} ${planned().length===1?'recipe':'recipes'} in your plan</strong><small>${g.buy.length} to buy · ${g.home.length} at home${state.extras.length?' · '+state.extras.length+' extras':''}</small></div>${action}`;
}
function render(){save();renderDock();if(view==='recipes')renderRecipe();if(view==='shopping')renderShopping();if(view==='pantry')renderPantry();if(view==='cart')renderCart();}
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function matchingRecipes(){
  const q=normalize($('search').value),collection=$('collectionFilter').value;
  return DATA.recipes.map((r,i)=>({r,i})).filter(({r})=>(!collection||r.collection===collection)&&normalize(r.title).includes(q));
}
function renderList(){
  const items=matchingRecipes();
  $('libraryCount').textContent=items.length+' of '+DATA.recipes.length+' recipes';
  $('recipeList').innerHTML=items.map(({r,i})=>`<button class="recipe-choice ${current===i?'selected':''}" data-recipe="${i}"><span class="emoji">${icon(r.title)}</span><span><strong>${esc(r.title)}</strong><small>${esc(r.collection)}${state.plan[r.id]?' · In your plan':''}</small></span></button>`).join('')||'<p>No recipes found.</p>';
}
function filterRecipes(){const matches=matchingRecipes();if(matches.length&&!matches.some(x=>x.i===current)){current=matches[0].i;page=0;}renderRecipe();}
function navigateRecipe(step){const matches=matchingRecipes();if(!matches.length)return;const index=matches.findIndex(x=>x.i===current);current=matches[(index+step+matches.length)%matches.length].i;page=0;renderRecipe();}

function renderRecipe(){
  const r=DATA.recipes[current],batch=state.plan[r.id]||1;renderList();
  $('detail').className='recipe-detail';
  $('detail').innerHTML=`<div class="recipe-top"><div><p class="eyebrow">${esc(r.collection)}</p><h1>${esc(r.title)}</h1></div><div class="arrows"><button data-prev aria-label="Previous recipe">←</button><button data-next aria-label="Next recipe">→</button></div></div><div class="recipe-tools"><span class="pill">${r.pages.length} full source ${r.pages.length===1?'page':'pages'}</span><div><label>Batches <input id="batches" type="number" min="0.5" max="10" step="0.5" value="${batch}"></label> <button id="addPlan" class="primary">${state.plan[r.id]?'✓ Update plan':'＋ Add to plan'}</button></div></div>
  ${state.plan[r.id]?`<div class="plan-next"><div><strong>✓ In your plan</strong><span>Check what you have, add extras, then build your cart.</span></div><button data-view="shopping" class="primary">Check kitchen →</button></div>`:''}
  ${r.issues?.length?`<details class="scan-notes" open><summary>About this scan</summary>${r.issues.map(issue=>`<p>${esc(issue)}</p>`).join('')}</details>`:''}
  <div class="recipe-grid"><div><div class="scan-frame"><button class="scan-button" id="zoom" aria-label="Enlarge original page"><img decoding="async" src="${r.pages[page]}" alt="Original scan for ${esc(r.title)}, page ${page+1}"></button></div><div class="page-controls"><button id="prevPage" ${page===0?'disabled':''} aria-label="Previous source page">←</button><span>Page ${page+1} of ${r.pages.length}</span><button id="nextPage" ${page===r.pages.length-1?'disabled':''} aria-label="Next source page">→</button></div><details><summary>OCR text</summary><p class="muted">Machine-read text needs checking against the scan.</p><pre>${esc(r.ocr)}</pre></details></div><section><h2>🥗 Ingredients</h2><p class="muted">For one batch. Mark anything you have enough of. Check extracted amounts against the original scan.</p>${r.ingredients.map(i=>`<div class="ingredient-row"><span class="emoji">${icon(i.name)}</span><span class="text">${esc(i.raw)}${i.optional?'<small> · Optional</small>':''}</span><button aria-label="${isHome(i.id)?'Need to buy':'Have enough'} ${esc(i.name)}" class="${isHome(i.id)?'stocked':''}" data-home="${esc(i.id)}">${isHome(i.id)?'✓ At home':'Have it?'}</button></div>`).join('')}<h3 class="section-title">Your notes</h3><textarea id="notes" class="notes" placeholder="Less spice, a favorite brand, make double…">${esc(state.notes[r.id]||'')}</textarea><p class="muted">Saved in this browser.</p></section></div>`;
  $('addPlan').onclick=()=>{const n=Number($('batches').value);if(!Number.isFinite(n)||n<.5||n>10)return notify('Choose ½ to 10 batches.');state.plan[r.id]=n;changed();notify('Plan saved. Check your kitchen next.');};
  $('notes').onchange=()=>{state.notes[r.id]=$('notes').value;save();};
  $('zoom').onclick=()=>{$('fullScan').src=r.pages[page];$('scanDialog').showModal();};
  $('prevPage').onclick=()=>{page--;renderRecipe();};$('nextPage').onclick=()=>{page++;renderRecipe();};
}
function purchaseKey(i){return DATA.products[i.id]?.key||i.id;}
function defaultUnit(i){return ['orange','lime','avocado'].includes(purchaseKey(i))?'items':'packages';}
function rowHTML(i,mode){
  const need=i.quantity?amount(i.quantity)+' '+esc(i.unit||''):'To taste / choose pack size';
  const key=purchaseKey(i),unit=state.purchaseUnits[key]||defaultUnit(i);
  const actions=mode==='home'?`<span class="stock-label">✓ At home</span><button data-home="${esc(i.id)}">Need to buy</button>`:mode==='skip'?`<button data-skip="${esc(i.id)}">Include this time</button>`:`<button data-home="${esc(i.id)}" class="stocked">✓ Have enough</button><label class="pack-control">Buy <input data-packs="${esc(key)}" aria-label="Purchase quantity for ${esc(i.name)}" type="number" min="1" max="99" placeholder="Auto" value="${state.cartQty[key]||''}"></label><select data-purchase-unit="${esc(key)}" aria-label="Purchase unit for ${esc(i.name)}"><option value="packages" ${unit==='packages'?'selected':''}>packages</option><option value="items" ${unit==='items'?'selected':''}>items</option></select><button data-skip="${esc(i.id)}" class="text-button">Skip this time</button>`;
  return `<div class="shopping-row ${mode==='buy'?'buy-row':''}"><span class="emoji">${icon(i.name)}</span><div class="text"><strong>${esc(i.name)}</strong><small>${esc(i.recipes.join(' · '))}</small></div>${mode==='home'?'':`<span class="need">${need}${i.unknown&&i.quantity?' + extra':''}</span>`}<div class="row-actions">${actions}</div>${mode==='buy'?`<details class="product-preference"><summary>Product preference</summary><label>Product or brand<input data-preference="${esc(key)}" aria-label="Product preference for ${esc(i.name)}" maxlength="160" value="${esc(state.choices[key]||DATA.products[i.id]?.name||'')}" placeholder="Choose a product or brand…"></label><small>Used when this demo builds your cart.</small></details>`:''}</div>`;
}
function renderShopping(){
  const g=groups();
  const meals=planned().map(r=>`<div class="meal"><span class="emoji">${icon(r.title)}</span><strong>${esc(r.title)}</strong><button data-remove="${esc(r.id)}" aria-label="Remove ${esc(r.title)} from plan">×</button><div class="meal-controls"><label>Batches <input data-batch="${esc(r.id)}" aria-label="Batches for ${esc(r.title)}" type="number" min="0.5" max="10" step="0.5" value="${state.plan[r.id]}"></label>${r.ingredients.some(i=>i.optional)?`<label><input data-optional="${esc(r.id)}" type="checkbox" ${state.optional[r.id]?'checked':''}> Optional extras</label>`:''}</div></div>`).join('');
  $('shoppingBody').innerHTML=`${steps(2)}<div class="shopping-grid"><div>${meals?`<div class="meal-grid">${meals}</div>`:'<div class="empty compact"><h2>What are you cooking?</h2><button data-view="recipes" class="primary">Choose recipes</button></div>'}<section class="shopping-section buy-section"><h2>🛒 To buy <span class="section-count">${g.buy.length}</span></h2><p class="muted">Leave Buy on Auto to use the recipe amount. Mark anything you already have.</p>${g.buy.map(i=>rowHTML(i,'buy')).join('')||'<p>No missing ingredients.</p>'}</section><section class="shopping-section home-section"><h2>🏡 Already at home <span class="section-count">${g.home.length}</span></h2>${g.home.map(i=>rowHTML(i,'home')).join('')||'<p>Items you mark as at home will appear here.</p>'}<button data-view="pantry" class="text-button">Manage home items →</button></section>${g.skip.length?`<details open><summary>Skipped this time · ${g.skip.length}</summary>${g.skip.map(i=>rowHTML(i,'skip')).join('')}</details>`:''}<section class="shopping-section"><h2>Anything else?</h2><p class="muted">Add everyday groceries to the same family cart.</p><div class="extras">${DATA.extras.map((x,i)=>`<button data-extra="${i}" aria-pressed="${state.extras.includes(i)}" class="${state.extras.includes(i)?'stocked':''}">${state.extras.includes(i)?'✓':'＋'} ${icon(x.name)} ${esc(x.name)}</button>`).join('')}</div></section></div><aside class="cart-summary"><p class="eyebrow">SPROUTS FARMERS MARKET</p><h2>🛒 Instacart</h2><p class="family-target">Sprouts · Family Cart</p><div class="summary-line"><span>Recipes</span><strong>${planned().length}</strong></div><div class="summary-line"><span>To buy</span><strong>${g.buy.length}</strong></div><div class="summary-line"><span>At home</span><strong>${g.home.length}</strong></div><div class="summary-line"><span>Household extras</span><strong>${state.extras.length}</strong></div><button id="buildCart" data-build class="primary">${state.cartBuilt?'Update Family Cart':'Add to Family Cart'} →</button><p class="muted">Saved products fill the cart automatically. You can change products and quantities.</p></aside></div>`;
}
function renderPantry(){
  const rows=new Map();for(const r of DATA.recipes)for(const i of r.ingredients)if(!rows.has(i.id))rows.set(i.id,i);
  const q=$('pantrySearch').value.toLowerCase();
  $('stockCount').textContent=state.home.length+' ingredients at home';
  $('pantryBody').innerHTML=[...rows.values()].filter(i=>(!$('onlyStocked').checked||isHome(i.id))&&i.name.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>`<button aria-pressed="${isHome(i.id)}" class="pantry-item ${isHome(i.id)?'stocked':''}" data-home="${esc(i.id)}"><span>${icon(i.name)} ${esc(i.name)}</span><small>${isHome(i.id)?'✓ At home':'Need to buy'}</small></button>`).join('')||'<p>No matching ingredients.</p>';
}
function buildCart(){
  const before=JSON.stringify(state.cart);state.cartBuilt=true;syncCart();save();
  cartMessage=JSON.stringify(state.cart)===before?'Your cart is up to date. No duplicates added.':'Cart ready. Missing ingredients and extras are included; home items are left out.';
  go('cart');
}
function totals(){const subtotal=Object.values(state.cart).reduce((n,x)=>n+x.price*x.qty,0);const credit=subtotal>=35?10:0;return {subtotal,credit,total:subtotal-credit};}
function renderCart(){
  if(!state.cartBuilt){$('cartBody').innerHTML=`${steps(3)}<div class="empty"><h2>Your cart starts with your shopping list</h2><p>Check home items and add any extras, then build your cart.</p><button data-view="shopping" class="primary">Check kitchen →</button>${planned().length||state.extras.length?'<button data-build class="secondary">Build cart →</button>':''}</div>`;return;}
  const g=groups(),t=totals();
  $('cartBody').innerHTML=`${steps(3)}<p id="cartMessage" class="cart-status" role="status">${esc(cartMessage||'Your cart follows your current shopping list. Changes to home items update it automatically.')}</p><div class="shopping-grid"><div><div class="cart-heading"><h2 id="cartItemCount">${cartCount()} items</h2><span class="pill">👨‍👩‍👧 Family cart</span></div><p class="muted">Example products and prices. Change a product or quantity to try the flow.</p><div id="cartRows">${Object.entries(state.cart).map(([id,x])=>`<div class="cart-row"><span class="product-emoji">${icon(x.name)}</span><div class="cart-product"><strong>${esc(x.name)}</strong>${x.kind==='extra'?'':`<small>${esc(x.sources.join(' · '))}</small>`}<span class="product-source">${x.kind==='extra'?'Household extra':x.known?'✓ Saved product':'Suggested product'}</span><details><summary>Change product</summary><select data-choice="${esc(id)}" aria-label="Choose product for ${esc(x.baseName)}"><option value="">Select an alternative…</option><option value="original">${esc(x.baseName)}</option><option value="store">Store-brand option</option><option value="organic">Organic option</option></select></details></div><div class="cart-price"><strong data-lineprice="${esc(id)}">${money(x.price*x.qty)}</strong><small>${money(x.price)} each</small><label>Qty <input data-cartqty="${esc(id)}" type="number" min="1" max="99" value="${x.qty}" aria-label="Quantity of ${esc(x.name)}"></label><button data-cartremove="${esc(id)}" class="text-button" aria-label="Remove ${esc(x.name)}">Remove</button></div></div>`).join('')||'<p>Your cart is empty. Add recipes or extras to keep shopping.</p>'}</div><section class="home-recap"><h3>🏡 Left out: already at home</h3><p>${g.home.length?g.home.map(i=>esc(i.name)).join(', '):'No items marked as at home.'}</p><button data-view="shopping" class="text-button">Change home items or add extras →</button></section></div><aside class="cart-summary"><p class="eyebrow">EXAMPLE TOTAL</p><h2>Your shop</h2><div class="summary-line"><span>Subtotal</span><strong id="cartSubtotal">${money(t.subtotal)}</strong></div><div id="cartCreditRow" class="summary-line" ${t.credit?'':'hidden'}><span>United card credit</span><strong id="cartCredit">−${money(t.credit)}</strong></div><div class="summary-line total-line"><span>Before tax & fees</span><strong id="cartTotal">${money(t.total)}</strong></div><p class="muted">Sample prices and credit illustrate checkout. No live store or payment is connected.</p><button data-checkout class="primary" ${!cartCount()?'disabled':''}>Review checkout →</button><button data-view="shopping" class="summary-back">← Keep shopping</button></aside></div>`;
}
function refreshCartTotals(){
  if(view!=='cart'||!$('cartItemCount'))return;
  const t=totals();$('cartItemCount').textContent=cartCount()+' items';
  $('cartSubtotal').textContent=money(t.subtotal);$('cartCredit').textContent='−'+money(t.credit);
  $('cartCreditRow').hidden=!t.credit;$('cartTotal').textContent=money(t.total);
  document.querySelectorAll('[data-lineprice]').forEach(el=>{const x=state.cart[el.dataset.lineprice];if(x)el.textContent=money(x.price*x.qty);});
}
function reviewCheckout(){
  if(!cartCount())return;
  const t=totals(),g=groups();
  $('checkoutBody').innerHTML=`<div class="checkout-store"><strong>🌱 Sprouts Farmers Market</strong><span>Family Cart · Delivery</span></div><div class="summary-line"><span>Recipe ingredients + household extras</span><strong>${cartCount()} items</strong></div><div class="summary-line"><span>Already at home, not ordered</span><strong>${g.home.length}</strong></div><div class="summary-line"><span>Example subtotal</span><strong>${money(t.subtotal)}</strong></div>${t.credit?`<div class="summary-line"><span>Example United card credit</span><strong>−${money(t.credit)}</strong></div>`:''}<div class="summary-line"><span>Instacart+ delivery</span><strong>$0.00</strong></div><div class="summary-line total-line"><span>Before tax, service fee & tip</span><strong>${money(t.total)}</strong></div><p class="muted">This is a checkout preview with sample prices and benefits. The video shows the real order, final charges and confirmation email.</p>`;
  $('checkoutDialog').showModal();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.view)go(b.dataset.view);
  if(b.dataset.recipe!=null){current=Number(b.dataset.recipe);page=0;go('recipes');}
  if('prev'in b.dataset)navigateRecipe(-1);
  if('next'in b.dataset)navigateRecipe(1);
  if(b.dataset.home)toggleHome(b.dataset.home);
  if(b.dataset.remove){delete state.plan[b.dataset.remove];changed();}
  if(b.dataset.skip){const id=b.dataset.skip;state.skipped=state.skipped.includes(id)?state.skipped.filter(x=>x!==id):[...state.skipped,id];changed();}
  if(b.dataset.extra!=null){const n=Number(b.dataset.extra);state.extras=state.extras.includes(n)?state.extras.filter(x=>x!==n):[...state.extras,n];changed();}
  if('close'in b.dataset)b.closest('dialog').close();
  if('build'in b.dataset)buildCart();
  if('checkout'in b.dataset)reviewCheckout();
  if(b.dataset.cartremove){const id=b.dataset.cartremove,x=state.cart[id];if(x.kind==='extra')state.extras=state.extras.filter(n=>'extra-'+n!==id);else state.skipped=[...new Set([...state.skipped,...x.ingredients])];delete state.cartQty[id];cartMessage='Item removed. It is skipped for this shop.';changed();}
});
function savePurchaseField(el){
  if(el.dataset.cartqty){const n=Number(el.value);if(Number.isFinite(n)&&n>=1&&n<=99)state.cartQty[el.dataset.cartqty]=Math.ceil(n);syncCart();save();refreshCartTotals();}
  if(el.dataset.packs){const n=Number(el.value);if(el.value===''||!Number.isFinite(n)||n<1||n>99)delete state.cartQty[el.dataset.packs];else state.cartQty[el.dataset.packs]=Math.ceil(n);syncCart();save();}
  if(el.dataset.preference){const text=el.value.trim();if(text)state.choices[el.dataset.preference]=text;else delete state.choices[el.dataset.preference];syncCart();save();}
}
document.addEventListener('input',e=>savePurchaseField(e.target));
document.addEventListener('change',e=>{
  const el=e.target;savePurchaseField(el);
  if(el.dataset.purchaseUnit){state.purchaseUnits[el.dataset.purchaseUnit]=el.value;save();}
  if(el.dataset.batch){const n=Number(el.value);if(Number.isFinite(n)&&n>=.5&&n<=10)state.plan[el.dataset.batch]=n;changed();}
  if(el.dataset.optional){state.optional[el.dataset.optional]=el.checked;changed();}
  if(el.dataset.choice&&el.value){const x=state.cart[el.dataset.choice];state.choices[el.dataset.choice]=(el.value==='original'?'':el.value==='organic'?'Organic option: ':'Store-brand option: ')+x.baseName;changed();}
});
$('collectionFilter').innerHTML='<option value="">All collections</option>'+[...new Set(DATA.recipes.map(r=>r.collection))].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
$('collectionFilter').onchange=filterRecipes;$('search').oninput=filterRecipes;$('pantrySearch').oninput=renderPantry;$('onlyStocked').onchange=renderPantry;
$('import').onclick=()=>$('importDialog').showModal();$('watch').onclick=()=>$('videoDialog').showModal();
$('cartVideo').onclick=()=>{$('checkoutDialog').close();$('videoDialog').showModal();};
$('videoDialog').onclose=()=>$('videoDialog').querySelector('video').pause();
$('reset').onclick=()=>{state=defaults();cartMessage='';save();go('recipes');notify('Demo reset.');};
syncCart();go(location.hash.slice(1)||'recipes');
window.RecetasDemo={grocery,getState:()=>structuredClone(state)};
