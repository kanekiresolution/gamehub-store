const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const products = [
  {id:"brawl",title:"Brawl Stars",desc:"Гемы и предложения",category:"supercell",price:199,emoji:"💥",i1:"#6e3b9c",i2:"#22203e"},
  {id:"clashroyale",title:"Clash Royale",desc:"Игровые предложения",category:"supercell",price:299,emoji:"👑",i1:"#246ba5",i2:"#1b2141"},
  {id:"clashclans",title:"Clash of Clans",desc:"Игровые предложения",category:"supercell",price:299,emoji:"⚔️",i1:"#a75b24",i2:"#292039"},
  {id:"hayday",title:"Hay Day",desc:"Алмазы и предложения",category:"supercell",price:199,emoji:"🌾",i1:"#4e9c50",i2:"#1b2b2a"},
  {id:"ps",title:"PlayStation",desc:"Пополнение PS Store",category:"ps",price:500,emoji:"🎮",i1:"#245ad5",i2:"#171d40"},
  {id:"steam",title:"Steam",desc:"Пополнение кошелька",category:"steam",price:500,emoji:"🕹️",i1:"#3b6588",i2:"#171e2d"}
];
const cart = {};
let category = "all";
const rub = n => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
function render() {
  const list = products.filter(p => category === "all" || p.category === category);
  document.querySelector("#catalog").innerHTML = list.map(p => `
    <article class="product" style="--glow:${p.i1};--icon1:${p.i1};--icon2:${p.i2}">
      <div class="game-icon">${p.emoji}</div>
      <h3>${p.title}</h3><p class="desc">${p.desc}</p>
      <div class="product-bottom"><span class="price">${rub(p.price)}</span>
      <button class="add" data-add="${p.id}" aria-label="Добавить ${p.title}">+</button></div>
      ${cart[p.id] ? `<div class="qty">В корзине: ${cart[p.id]}</div>` : ""}
    </article>`).join("");
  document.querySelector("#cart-count").textContent = Object.values(cart).reduce((a,b)=>a+b,0);
  document.querySelector("#total").textContent = rub(products.reduce((s,p)=>s+p.price*(cart[p.id]||0),0));
}
document.querySelector("#tabs").addEventListener("click", e => {
  const b=e.target.closest("[data-category]"); if(!b)return;
  category=b.dataset.category;
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));
  document.querySelector("#catalog-title").textContent=({all:"Популярное",supercell:"Игры Supercell",ps:"PlayStation",steam:"Steam"})[category];
  render();
});
document.querySelector("#catalog").addEventListener("click",e=>{
  const b=e.target.closest("[data-add]");if(!b)return;
  cart[b.dataset.add]=(cart[b.dataset.add]||0)+1;render();
});
document.querySelector("#homeBtn").addEventListener("click",()=>{category="all";document.querySelectorAll(".tab").forEach((x,i)=>x.classList.toggle("active",i===0));document.querySelector("#catalog-title").textContent="Популярное";render();window.scrollTo({top:0,behavior:"smooth"});});
document.querySelector("#cartBtn").addEventListener("click",()=>{
  const chosen=products.filter(p=>cart[p.id]);
  if(!chosen.length){alert("Корзина пока пуста.");return;}
  alert("В корзине:\n"+chosen.map(p=>`${p.title} × ${cart[p.id]} — ${rub(p.price*cart[p.id])}`).join("\n")+"\n\nИтого: "+rub(chosen.reduce((s,p)=>s+p.price*cart[p.id],0)));
});
const modal=document.querySelector("#modal");
document.querySelector("#checkoutBtn").addEventListener("click",()=>{
  if(!Object.values(cart).some(Boolean)){alert("Сначала добавь товар в корзину.");return;}
  modal.classList.remove("hidden");
});
document.querySelector("#closeModal").addEventListener("click",()=>modal.classList.add("hidden"));
fetch("/api/config").then(r=>r.json()).then(c=>{document.querySelector("#paymentDetails").textContent=c.paymentDetails||"После оформления продавец сообщит дальнейшие шаги.";}).catch(()=>{});
document.querySelector("#sendOrder").addEventListener("click",async()=>{
  const items=products.filter(p=>cart[p.id]).map(p=>({title:p.title,price:p.price,qty:cart[p.id]}));
  const total=items.reduce((s,p)=>s+p.price*p.qty,0);
  const btn=document.querySelector("#sendOrder"), status=document.querySelector("#status");
  btn.disabled=true;btn.textContent="Отправляем…";status.textContent="";
  try{
    const res=await fetch("/api/order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items,total,customer:document.querySelector("#customer").value,contact:document.querySelector("#contact").value,note:document.querySelector("#note").value})});
    const data=await res.json();
    if(!res.ok||!data.ok)throw new Error(data.error||"Не получилось отправить заказ.");
    status.textContent=data.message;Object.keys(cart).forEach(k=>delete cart[k]);render();
  }catch(err){status.textContent=err.message+" Проверь подключение и попробуй снова.";}
  finally{btn.disabled=false;btn.textContent="Отправить заказ";}
});
render();
