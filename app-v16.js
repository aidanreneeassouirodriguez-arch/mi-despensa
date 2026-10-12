const $=id=>document.getElementById(id),uid=()=>crypto.randomUUID(),today=()=>new Date().toISOString().slice(0,10),escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const basics=[{name:'Huevos',qty:6,unit:'uds.'},{name:'Agua',qty:6,unit:'botellas'},{name:'Leche',qty:6,unit:'bricks'},{name:'Café normal Dolce Gusto',qty:4,unit:'cápsulas'},{name:'Café descafeinado Dolce Gusto',qty:4,unit:'cápsulas'},{name:'Barritas',qty:4,unit:'uds.'},{name:'Pasta',qty:500,unit:'g'}];
let state=JSON.parse(localStorage.getItem('despensa_v1')||'{"lots":[],"history":[]}'),client=null,user=null,house=null,remote=false;const config=JSON.parse(localStorage.getItem('despensa_remote')||'{}');
function persist(){localStorage.setItem('despensa_v1',JSON.stringify(state));render()}
function go(page){$('editor').classList.add('hidden');document.querySelectorAll('section[data-page]').forEach(s=>s.classList.toggle('active',s.dataset.page===page));document.querySelectorAll('nav button').forEach((b,i)=>b.classList.toggle('active',['inicio','inventario','foto','compra','ajustes'][i]===page));render();if(page==='compra')refreshShopping();scrollTo(0,0)}
function showForm(){document.querySelectorAll('section[data-page]').forEach(s=>s.classList.remove('active'));$('editor').classList.remove('hidden');$('pname').value='';$('pqty').value=1;$('punit').value='uds.';$('plocation').value='Nevera';$('pexpires').value='';$('pdatetype').value='Caducidad';$('pfreeze').value='none';$('pfreezeqty').value=0;$('formerror').textContent='';toggleFreeze();scrollTo(0,0)}
function closeForm(){go('inventario')};function toggleFreeze(){$('freezearea').classList.toggle('hidden',$('pfreeze').value!=='part')}
function normalize(name){return name.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()}
function isBasic(l,b){let n=normalize(l.name),v=normalize(b.name);if(v==='pasta')return /pasta|macarron|espaguet|spaghetti|tallarin/.test(n);if(v==='barritas')return /barrita/.test(n);if(v==='huevos')return /huev/.test(n);if(v==='leche')return /leche/.test(n);if(v==='agua')return /agua/.test(n);return n===v}
function convert(l,b){if(l.unit===b.unit)return l.qty;if(b.unit==='g'&&l.unit==='kg')return l.qty*1000;if(b.unit==='bricks'&&l.unit==='uds.')return l.qty;if(b.unit==='botellas'&&l.unit==='uds.')return l.qty;if(b.unit==='uds.'&&l.unit==='paquetes')return l.qty;return 0}
function lows(){return basics.map(b=>({...b,current:state.lots.filter(l=>isBasic(l,b)).reduce((a,l)=>a+convert(l,b),0)})).filter(b=>b.current<b.qty)}
function due(l){if(!l.expires)return null;return Math.ceil((new Date(l.expires+'T12:00:00')-new Date())/86400000)}
function render(){let low=lows();$('numproducts').textContent=state.lots.filter(l=>l.qty>0).length;$('numlow').textContent=low.length;$('lows').innerHTML=low.length?low.map(b=>`<div class="line"><span>${escapeHtml(b.name)}</span><span class="tag warn">Faltan ${+(b.qty-b.current).toFixed(2)} ${escapeHtml(b.unit)}</span></div>`).join(''):'<p class="muted">Todos los básicos por encima del mínimo.</p>';$('expires').innerHTML=state.lots.filter(l=>l.expires&&l.qty>0).sort((a,b)=>a.expires.localeCompare(b.expires)).slice(0,5).map(l=>`<div class="line"><span>${escapeHtml(l.name)} <span class="muted">(${escapeHtml(l.location)})</span></span><span class="tag ${due(l)<0?'red':due(l)<4?'warn':''}">${escapeHtml(l.expires)}</span></div>`).join('')||'<p class="muted">Aún no hay fechas registradas.</p>';renderShopping();$('minimums').innerHTML=basics.map(b=>`<div class="line"><span>${escapeHtml(b.name)}</span><span>${b.qty} ${escapeHtml(b.unit)}</span></div>`).join('');renderInventory();$('connection').textContent=remote?'☁️ Inventario sincronizado con el hogar':'📱 Datos locales de este iPhone · sincronización pendiente'}
function renderInventory(){let q=normalize($('search').value),loc=$('placefilter').value;let lots=state.lots.filter(l=>l.qty>0&&normalize(l.name).includes(q)&&(!loc||l.location===loc));$('inventorylist').innerHTML=lots.length?lots.map(l=>`<div class="card"><div class="line"><div><div class="name">${escapeHtml(l.name)}</div><span class="tag">${escapeHtml(l.location)}</span> ${l.expires?`<span class="tag ${due(l)<4?'warn':''}">${escapeHtml(l.expires)}</span>`:''}</div><strong>${l.qty} ${escapeHtml(l.unit)}</strong></div><div class="actions" style="margin-top:10px"><button class="alt smallbtn" onclick="moveLot('${l.id}','consume')">− Consumir</button><button class="alt smallbtn" onclick="moveLot('${l.id}','freeze')">❄️ Congelar</button><button class="alt smallbtn" onclick="moveLot('${l.id}','thaw')">Descongelar</button><button class="alt smallbtn" onclick="editLot('${l.id}')">✏️ Editar</button><button class="alt smallbtn" onclick="removeLot('${l.id}')">🗑️ Eliminar</button></div></div>`).join(''):'<div class="card muted">No hay productos registrados con estos filtros.</div>'}
async function commit(lots,kind,detail){if(remote){for(const lot of lots){const {error}=await client.from('lots').upsert({...lot,household_id:house});if(error){alert('No se ha podido sincronizar: '+error.message);await pull();return false}}await client.from('movements').insert({household_id:house,kind,detail});await pull()}else{for(let lot of lots){let n=state.lots.findIndex(x=>x.id===lot.id);if(n<0)state.lots.push(lot);else state.lots[n]=lot}state.history.push({at:new Date().toISOString(),kind,detail});persist()}return true}
async function saveProduct(){let name=$('pname').value.trim(),qty=+$('pqty').value,unit=$('punit').value,location=$('plocation').value,freeze=$('pfreeze').value,fqty=freeze==='all'?qty:freeze==='part'?+$('pfreezeqty').value:0;if(!name||!Number.isFinite(qty)||qty<=0||fqty<0||fqty>qty||!Number.isFinite(fqty)){$('formerror').textContent='Comprueba el nombre y las cantidades.';return}if(fqty>0&&location==='Congelador'){$('formerror').textContent='Si todo está ya en congelador, selecciona “No” en congelación.';return}let base={name,unit,expires:$('pexpires').value||null,date_type:$('pdatetype').value,created_at:new Date().toISOString(),frozen_at:null};let lots=[];if(qty-fqty>0)lots.push({...base,id:uid(),qty:qty-fqty,location});if(fqty>0)lots.push({...base,id:uid(),qty:fqty,location:'Congelador',frozen_at:today()});if(await commit(lots,'compra',`${qty} ${unit} ${name}; congelado: ${fqty}`))go('inventario')}

// Edición y eliminación lógica de lotes. Se conserva el historial, sin borrar físicamente datos.
function closeLotEditor(){document.getElementById('lotEditOverlay')?.remove()}
function editLot(id){
 const l=state.lots.find(x=>x.id===id);if(!l)return;
 closeLotEditor();
 const overlay=document.createElement('div');overlay.id='lotEditOverlay';
 overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:99999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px';
 overlay.innerHTML=`<form id="lotEditForm" style="background:#fff;color:#17392c;border-radius:20px;padding:22px;max-width:540px;width:100%;margin:15px auto 35px;box-shadow:0 12px 44px #0003">
 <h2 style="margin:0 0 14px">Editar ficha del producto</h2>
 <p style="margin:0 0 15px;color:#566c64;font-size:.85em">Los cambios afectan únicamente a este lote, no a otros del mismo producto.</p>
 <label for="leName">Producto</label><input id="leName" required>
 <div class="two"><div><label for="leQty">Cantidad</label><input id="leQty" type="number" min="0" step="any" required></div><div><label for="leUnit">Unidad</label><select id="leUnit"><option>uds.</option><option>g</option><option>kg</option><option>ml</option><option>L</option><option>bricks</option><option>botellas</option><option>cápsulas</option><option>paquetes</option></select></div></div>
 <label for="leLocation">Ubicación</label><select id="leLocation"><option>Nevera</option><option>Congelador</option><option>Despensa</option></select>
 <label for="leExpires">Fecha de caducidad o consumo preferente</label><input id="leExpires" type="date">
 <label for="leType">Tipo de fecha</label><select id="leType"><option>Caducidad</option><option>Consumo preferente</option><option>No especificada</option></select>
 <label for="lePurchased">Fecha de registro/compra</label><input id="lePurchased" type="date">
 <label for="leFrozen">Fecha de congelación (si procede)</label><input id="leFrozen" type="date">
 <label for="leThawed">Fecha de descongelación (si procede)</label><input id="leThawed" type="date">
 <p class="error small" id="leError" role="alert"></p>
 <div class="actions"><button type="submit" id="leSave">Guardar cambios</button><button type="button" class="alt" id="leCancel">Cancelar</button></div>
 </form>`;
 document.body.appendChild(overlay);
 const f=overlay.querySelector('form'), field=id=>f.querySelector('#'+id);
 field('leName').value=l.name;field('leQty').value=l.qty;field('leUnit').value=l.unit;
 field('leLocation').value=l.location;field('leExpires').value=l.expires||'';
 field('leType').value=l.date_type||'No especificada';
 field('lePurchased').value=(l.created_at||'').slice(0,10);
 field('leFrozen').value=l.frozen_at||'';field('leThawed').value=l.thawed_at||'';
 field('leCancel').addEventListener('click',closeLotEditor);
 overlay.addEventListener('click',e=>{if(e.target===overlay)closeLotEditor()});
 f.addEventListener('submit',async e=>{
  e.preventDefault();const name=field('leName').value.trim(),qty=Number(field('leQty').value),location=field('leLocation').value;
  if(!name||!Number.isFinite(qty)||qty<0){field('leError').textContent='Revisa el nombre y la cantidad.';return;}
  const purchase=field('lePurchased').value;
  if(!purchase){field('leError').textContent='Indica la fecha de compra o registro.';return;}
  const updated={...l,name,qty,unit:field('leUnit').value,location,expires:field('leExpires').value||null,date_type:field('leType').value,
   created_at:purchase+'T12:00:00.000Z',frozen_at:location==='Congelador'?(field('leFrozen').value||l.frozen_at||today()):null,
   thawed_at:field('leThawed').value||null};
  const btn=field('leSave');btn.disabled=true;btn.textContent='Guardando…';
  try{const ok=await commit([updated],'edicion',`${l.name}: ficha modificada`);if(ok){closeLotEditor();render()}else{field('leError').textContent='No se han guardado los cambios.'}}
  catch(err){field('leError').textContent='Error al guardar: '+err.message}
  finally{btn.disabled=false;btn.textContent='Guardar cambios'}
 });
}
async function removeLot(id){
 const l=state.lots.find(x=>x.id===id);if(!l)return;
 if(!confirm(`¿Eliminar ${l.name} (${l.qty} ${l.unit}) de ${l.location}?`))return;
 // qty=0 lo oculta del inventario y permite preservar auditoría y movimientos.
 if(await commit([{...l,qty:0}],'eliminacion',`${l.qty} ${l.unit} ${l.name} (${l.location})`))alert('Producto retirado del inventario.');
}
async function moveLot(id,action){let l=state.lots.find(x=>x.id===id);if(!l)return;if(action==='freeze'&&l.location==='Congelador'){alert('Ya está congelado.');return}if(action==='thaw'&&l.location!=='Congelador'){alert('Este lote no está en el congelador.');return}let label=action==='consume'?'consumir':action==='freeze'?'congelar':'descongelar';let raw=prompt(`Cantidad de ${l.name} a ${label} (${l.unit}). Máximo ${l.qty}:`,String(l.qty));if(raw===null)return;let amount=Number(raw.replace(',','.'));if(!Number.isFinite(amount)||amount<=0||amount>l.qty){alert('Cantidad inválida');return}let updated={...l,qty:+(l.qty-amount).toFixed(3)},lots=[updated];if(action!=='consume'){lots.push({...l,id:uid(),qty:amount,location:action==='freeze'?'Congelador':'Nevera',frozen_at:action==='freeze'?today():l.frozen_at,thawed_at:action==='thaw'?today():null,created_at:new Date().toISOString()})}await commit(lots,action,`${amount} ${l.unit} ${l.name}`)}
function copyShopping(){let t=lows().map(b=>`☐ ${b.name}: ${+(b.qty-b.current).toFixed(2)} ${b.unit}`).join('\n');navigator.clipboard?.writeText(t).then(()=>alert('Lista copiada')).catch(()=>prompt('Copia la lista:',t))}
function backup(){let blob=new Blob([JSON.stringify({version:1,...state},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mi-despensa-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function restore(e){if(remote){alert('Desconecta la sincronización antes de importar datos locales');return}try{let json=JSON.parse(await e.target.files[0].text());if(!Array.isArray(json.lots))throw Error('Formato incorrecto');if(confirm('¿Reemplazar el inventario local por este respaldo?')){state={lots:json.lots,history:json.history||[]};persist()}}catch(err){alert(err.message)}}
// v1.5: OCR privado en el navegador, múltiples fotografías y revisión obligatoria.
let photoDrafts=[];
const photoInput=$('photo'); photoInput.multiple=true;photoInput.removeAttribute('capture');
photoInput.insertAdjacentHTML('afterend', '<p class="hint">Selecciona varias fotos de envases, fechas o un ticket. Las fotos no se suben a Supabase. Usa fotos cercanas y legibles.</p>');
$('ocrtext').insertAdjacentHTML('afterend','<div id="photoDrafts" aria-live="polite"></div>');
photoInput.addEventListener('change',e=>{const files=[...e.target.files];if(files.length){$('preview').src=URL.createObjectURL(files[0]);$('preview').style.display='block';$('ocrstatus').textContent=files.length+' foto(s) preparadas para leer.'}});
function loadScript(url){return new Promise((ok,fail)=>{let s=document.createElement('script');s.src=url;s.onload=ok;s.onerror=fail;document.head.appendChild(s)})}
async function readPhoto(){
 const files=[...photoInput.files];if(!files.length)return alert('Selecciona primero una o varias fotografías');
 const status=$('ocrstatus');status.textContent='Cargando lector de etiquetas…';
 let worker;
 try{
  if(!window.Tesseract)await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  worker=await Tesseract.createWorker('spa');photoDrafts=[];let full=[];
  for(let i=0;i<files.length;i++){
   status.textContent=`Leyendo fotografía ${i+1} de ${files.length}…`;
   const result=await worker.recognize(files[i]);let text=(result.data.text||'').trim();
   full.push('--- FOTO '+(i+1)+' ---\n'+text);
   photoDrafts.push(guessPhotoRecord(text,files[i].name));
  }
  $('ocrtext').value=full.join('\n\n');showPhotoDrafts();
  status.textContent='Lectura terminada. Corrige los campos antes de guardar; ningún producto se ha añadido todavía.';
 }catch(e){status.textContent='Error de lectura: '+e.message+'; puedes escribir o pegar el texto manualmente.'}
 finally{if(worker)await worker.terminate()}
}
function parseDateFromLabel(text){
 const matches=[...text.matchAll(/\b([0-3]?\d)[\/.-]([01]?\d)[\/.-](20\d{2}|\d{2})\b/g)];
 const dated=[];
 for(const m of matches){let y=Number(m[3]);if(y<100)y+=2000;const month=Number(m[2]),day=Number(m[1]);const d=new Date(Date.UTC(y,month-1,day));
  if(d.getUTCFullYear()!==y||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)continue;
  const around=text.slice(Math.max(0,m.index-55),m.index+15).toLowerCase();
  if(/fabricad|envasad|elaborad|lote|lot:/.test(around)&&!/caduc|consum/.test(around))continue;
  if(!/caduc|consum|best before|expir|vence/.test(around))continue;
  dated.push(`${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
 }
 return dated[0]||'';
}
function guessPhotoRecord(text,filename){
 const lines=text.split(/\n/).map(s=>s.trim()).filter(Boolean);
 const blacklist=/^(ingredientes|valores|informaci[oó]n|energ[ií]a|grasas|prote[ií]nas|hidratos|lote|fecha|caduc|consumir|peso neto|contenido|fabricado|nutricional|por 100|total|subtotal|iva|precio|importe|cajero|tarjeta|gracias|ticket)/i;
 const name=lines.find(s=>s.length>3&&s.length<70&&!blacklist.test(s)&&/[a-záéíóúñ]{3}/i.test(s)&&!/^\d+[.,]\d+\s*€?$/.test(s))||'';
 const weight=text.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
 const unit=weight?({kg:'kg',g:'g',ml:'ml',l:'L'})[weight[2].toLowerCase()]:'uds.';
 // Un envase de 500 g = cantidad 500 g; NO se deduce que haya dos envases.
 const quantity=weight?Number(weight[1].replace(',','.')):1;
 return {name:name.slice(0,90),qty:quantity,unit,location:'Nevera',expires:parseDateFromLabel(text),freeze:'none',freezeQty:0,filename,saved:false};
}
function extractPhoto(){const text=$('ocrtext').value.trim();if(!text)return alert('No hay texto para interpretar');
 const groups=text.split(/--- FOTO \d+ ---/).map(x=>x.trim()).filter(Boolean);
 photoDrafts=groups.map((t,i)=>guessPhotoRecord(t,'Texto '+(i+1)));
 showPhotoDrafts();$('ocrstatus').textContent='Propuestas basadas solo en texto visible. Comprueba el producto, las cantidades y las fechas.';
}
function showPhotoDrafts(){const box=$('photoDrafts');
 box.innerHTML='<h3>Revisar antes de incorporar</h3><p class="hint">Una propuesta por foto; las fotos generales y tickets no permiten contar automáticamente todos los productos. Añade más productos mediante el botón de abajo.</p>'+
 photoDrafts.map((p,i)=>`<div class="card" data-draft="${i}"><p><strong>Foto ${i+1}</strong> <span class="muted">${escapeHtml(p.filename)}</span> ${p.saved?'<span class="tag">Guardado</span>':''}</p>
 <label>Producto</label><input data-field="name" value="${escapeHtml(p.name)}" placeholder="Confirma el nombre" ${p.saved?'disabled':''}>
 <div class="two"><div><label>Cantidad total</label><input type="number" min="0.001" step="any" data-field="qty" value="${p.qty}" ${p.saved?'disabled':''}></div><div><label>Unidad</label><select data-field="unit" ${p.saved?'disabled':''}>${['uds.','g','kg','ml','L','bricks','botellas','cápsulas','paquetes'].map(u=>`<option ${p.unit===u?'selected':''}>${u}</option>`).join('')}</select></div></div>
 <label>Guardar en</label><select data-field="location" ${p.saved?'disabled':''}>${['Nevera','Congelador','Despensa'].map(u=>`<option ${p.location===u?'selected':''}>${u}</option>`).join('')}</select>
 <label>Caducidad o consumo preferente (si está confirmado)</label><input type="date" data-field="expires" value="${p.expires}" ${p.saved?'disabled':''}>
 <label>Congelación</label><select data-field="freeze" ${p.saved?'disabled':''}><option value="none">No congelar</option><option value="all">Congelar todo</option><option value="part">Congelar parte</option></select>
 <label>Cantidad a congelar (si es parcial)</label><input type="number" min="0" step="any" data-field="freezeQty" value="${p.freezeQty}" ${p.saved?'disabled':''}>
 <p class="hint">Si hay varias unidades con distintas caducidades, regístralas como lotes separados.</p>
 <button class="full" onclick="savePhotoDraft(${i})" ${p.saved?'disabled':''}>${p.saved?'Ya guardado':'Confirmar y añadir al inventario'}</button></div>`).join('')+
 '<button class="alt full" onclick="photoDrafts.push({name:\'\',qty:1,unit:\'uds.\',location:\'Nevera\',expires:\'\',freeze:\'none\',freezeQty:0,filename:\'Producto adicional\',saved:false});showPhotoDrafts()">+ Añadir otro producto a esta compra</button>';
}
async function savePhotoDraft(i){const p=photoDrafts[i];if(!p||p.saved)return;const row=document.querySelector(`[data-draft="${i}"]`);
 const val=k=>row.querySelector(`[data-field="${k}"]`).value;
 const name=val('name').trim(),qty=Number(val('qty')),fmode=val('freeze'),fq=fmode==='all'?qty:fmode==='part'?Number(val('freezeQty')):0,location=val('location');
 if(!name||!Number.isFinite(qty)||qty<=0||!Number.isFinite(fq)||fq<0||fq>qty)return alert('Corrige el nombre o las cantidades.');
 if(location==='Congelador'&&fq>0)return alert('Ya has elegido Congelador como ubicación. Selecciona No congelar.');
 const unit=val('unit'),expires=val('expires')||null;
 const base={name,unit,expires,date_type:expires?'Caducidad':'No especificada',created_at:new Date().toISOString(),frozen_at:null};
 const lots=[];
 if(qty-fq>0)lots.push({...base,id:uid(),qty:qty-fq,location});
 if(fq>0)lots.push({...base,id:uid(),qty:fq,location:'Congelador',frozen_at:today()});
 const btn=row.querySelector('button.full');btn.disabled=true;btn.textContent='Guardando…';
 try{if(await commit(lots,'compra',`Foto revisada: ${qty} ${unit} ${name}; congelado: ${fq}`)){p.saved=true;showPhotoDrafts();$('ocrstatus').textContent='Producto añadido. Puedes continuar revisando los demás.'}else{btn.disabled=false;btn.textContent='Reintentar (comprueba antes el inventario)'}}
 catch(e){alert('Error: '+e.message+'; comprueba el inventario antes de reintentar.');btn.disabled=false;btn.textContent='Comprobar antes de reintentar'}
}
async function initRemote(){if(!config.url||!config.key)return;try{if(!window.supabase)await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');client=window.supabase.createClient(config.url,config.key);$('authbox').classList.remove('hidden');const {data}=await client.auth.getUser();user=data.user;if(user)await signedIn();client.auth.onAuthStateChange(async(event,session)=>{if(session?.user){user=session.user;await signedIn()}})}catch(e){$('authstatus').textContent=e.message}}
function saveRemoteConfig(){let url=$('supaurl').value.trim(),key=$('supakey').value.trim();if(!url.startsWith('https://')||!key){alert('Introduce URL HTTPS y clave pública');return}localStorage.setItem('despensa_remote',JSON.stringify({url,key}));location.reload()}
async function login(){let email=$('email').value.trim();if(!email)return;let {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});$('authstatus').textContent=error?error.message:'Revisa tu correo y abre el enlace en este iPhone.'}
async function signedIn(){$('authstatus').textContent='Sesión iniciada: '+user.email;$('housebox').classList.remove('hidden');const {data,error}=await client.from('memberships').select('household_id').limit(1);if(!error&&data?.length){house=String(data[0].household_id).split(':')[0];await pull();await refreshShopping();client.channel('home-'+house).on('postgres_changes',{event:'*',schema:'public',table:'lots',filter:'household_id=eq.'+house},()=>pull()).subscribe();$('housecurrent').textContent='Hogar conectado: '+house}}
async function createHouse(){if(house){alert('Ya tienes un hogar conectado. No necesitas crear otro.');return}const {data:members,error:membershipError}=await client.from('memberships').select('household_id').limit(1);if(membershipError)return alert('No se pudo comprobar tu hogar: '+membershipError.message);if(members?.length){house=members[0].household_id;await pull();$('housecurrent').textContent='Hogar conectado: '+house;return}let {data,error}=await client.rpc('create_household');if(error)return alert(error.message);const parts=String(data||'').split(':');if(parts.length!==2||!isUuid(parts[0])||!isUuid(parts[1]))return alert('Respuesta inesperada al crear el hogar. No vuelvas a crearlo; comprueba tu sesión.');house=parts[0];$('housecurrent').textContent='Código de invitación (compártelo solo con la otra persona): '+data;await pull()}
async function joinHouse(){let code=$('housecode').value.trim();let {error}=await client.rpc('join_household',{join_id:code});if(error)return alert(error.message);location.reload()}
function isUuid(x){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x||''))}
async function pull(){if(!house)return;if(!isUuid(house)){const first=String(house).split(':')[0];if(!isUuid(first)){alert('Identificador de hogar incorrecto. Actualiza la página.');return}house=first;}let {data,error}=await client.from('lots').select('id,name,qty,unit,location,expires,date_type,created_at,frozen_at,thawed_at').eq('household_id',house).order('created_at',{ascending:false});if(error){alert('Error de lectura: '+error.message);return}state.lots=data;remote=true;render();renderShopping()}



// Mi Despensa v1.6: lista de compra integrada con los lotes, sin dobles altas.
let shoppingRows=[], shoppingBusy=false;
const shoppingDefaults={"Huevos":"Nevera","Leche":"Nevera","Agua":"Despensa","Café normal Dolce Gusto":"Despensa","Café descafeinado Dolce Gusto":"Despensa","Pasta":"Despensa","Barritas":"Despensa"};
const shoppingUnits=['uds.','g','kg','ml','L','bricks','botellas','cápsulas','paquetes'];
function shoppingUnitOptions(chosen){return shoppingUnits.map(u=>`<option ${u===chosen?'selected':''}>${escapeHtml(u)}</option>`).join('')}
function ensureShoppingUi(){
 const box=$('shoppinglist');if(!box||box.dataset.smart)return;box.dataset.smart='1';
 box.insertAdjacentHTML('beforebegin',`<div class="card" id="shoppingEntry"><h3>Agregar a la compra</h3>
 <label>Producto</label><input id="shopName" placeholder="Ej. Pan de molde" maxlength="120">
 <div class="two"><div><label>Cantidad</label><input id="shopQty" type="number" min="0.01" step="any" value="1"></div><div><label>Unidad</label><select id="shopUnit">${shoppingUnitOptions('uds.')}</select></div></div>
 <label>Guardar en</label><select id="shopLocation"><option>Nevera</option><option>Despensa</option><option>Congelador</option></select>
 <button onclick="addShoppingItem()" style="margin-top:12px">+ Añadir a la lista</button>
 <p class="hint">Marcar «Comprado» sumará la cantidad al inventario. Los mínimos se calculan automáticamente.</p></div>`);
 box.insertAdjacentHTML('afterend',`<div id="shoppingDone" class="card"><h3>Comprados</h3><p class="muted">Todavía no hay productos marcados.</p></div>`);
}
function shoppingAutoRows(){return lows().filter(b=>b.qty-b.current>0.000001).filter(b=>!shoppingRows.some(x=>!x.bought&&normalize(x.name)===normalize(b.name))).map(b=>({id:'auto-'+normalize(b.name),name:b.name,qty:+(b.qty-b.current).toFixed(3),unit:b.unit,location:shoppingDefaults[b.name]||'Despensa',bought:false,automatic:true}))}
function shoppingCard(r){return `<div class="card" style="padding:12px;margin:8px 0"><div class="line"><div><strong>${escapeHtml(r.name)}</strong><br><small class="muted">${r.automatic?'Reposición por mínimo · ':''}${escapeHtml(r.qty)} ${escapeHtml(r.unit)} · ${escapeHtml(r.location)}</small></div><button class="${r.bought?'alt':''}" onclick="toggleShopping('${escapeHtml(r.id)}')" ${shoppingBusy?'disabled':''}>${r.bought?'↶ Deshacer':'☐ Comprado'}</button></div>${!r.automatic&&!r.bought?`<button class="alt" onclick="deleteShopping('${escapeHtml(r.id)}')">Quitar de lista</button>`:''}</div>`}
function renderShopping(){ensureShoppingUi(); const box=$('shoppinglist');if(!box)return;
 if(!remote){box.innerHTML='<p class="muted">Conecta tu hogar en Ajustes para utilizar la lista compartida. El inventario local sigue disponible.</p>';$('shoppingDone').innerHTML='<h3>Comprados</h3><p class="muted">Inicia sesión para consultar la compra.</p>';return}
 const pending=[...shoppingRows.filter(x=>!x.bought),...shoppingAutoRows()];const done=shoppingRows.filter(x=>x.bought);
 box.innerHTML=`<h3>Pendientes (${pending.length})</h3>`+(pending.length?pending.map(shoppingCard).join(''):'<p class="muted">No hay compras pendientes. Los mínimos están cubiertos.</p>');
 $('shoppingDone').innerHTML=`<h3>Comprados (${done.length})</h3>`+(done.length?done.map(shoppingCard).join(''):'<p class="muted">Todavía no hay productos marcados.</p>');
}
async function refreshShopping(){if(!remote||!house||!client)return;const {data,error}=await client.from('shopping_items').select('id,name,qty,unit,location,bought,lot_id,created_at').eq('household_id',house).order('created_at',{ascending:false});if(error){$('shoppinglist').innerHTML='<p class="error">Lista no disponible: '+escapeHtml(error.message)+'. Ejecuta primero el SQL de la v1.6 en Supabase.</p>';return}shoppingRows=data||[];renderShopping()}
async function addShoppingItem(){if(!remote||!house)return alert('Conecta el hogar en Ajustes.');const name=$('shopName').value.trim(),qty=Number($('shopQty').value),unit=$('shopUnit').value,location=$('shopLocation').value;if(!name||!Number.isFinite(qty)||qty<=0)return alert('Introduce producto y cantidad válida.');const {error}=await client.from('shopping_items').insert({household_id:house,name,qty,unit,location});if(error)return alert(error.message);$('shopName').value='';await refreshShopping()}
async function toggleShopping(id){if(shoppingBusy)return;shoppingBusy=true;try{
 let row=shoppingRows.find(r=>r.id===id);
 if(id.startsWith('auto-')){row=shoppingAutoRows().find(r=>r.id===id);if(!row)return alert('El mínimo ya está cubierto.'); const {data,error}=await client.from('shopping_items').insert({household_id:house,name:row.name,qty:row.qty,unit:row.unit,location:row.location}).select('id').single();if(error)throw error;id=data.id;}
 if(!row)return;
 const {error}=await client.rpc('set_shopping_purchased',{p_item_id:id,p_bought:!row.bought});if(error)throw error;
 await pull();await refreshShopping();
 }catch(e){alert('No se pudo actualizar la compra: '+e.message);await refreshShopping()}finally{shoppingBusy=false;renderShopping()}}
async function deleteShopping(id){const row=shoppingRows.find(r=>r.id===id);if(!row||row.bought)return;if(!confirm('¿Quitar '+row.name+' de la lista?'))return;const {error}=await client.from('shopping_items').delete().eq('id',id).eq('bought',false);if(error)alert(error.message);await refreshShopping()}
// Actualizar la lista en ambos iPhone al recuperar el foco, incluso sin Realtime.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&remote){pull();refreshShopping()}});

if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./service-worker.js').catch(()=>{});$('supaurl').value=config.url||'';$('supakey').value=config.key||'';render();initRemote();
