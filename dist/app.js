const $=id=>document.getElementById(id);
const inputIds=['siteName','period','energyHP','maxDemand','hoursElapsed','hoursMonth','daysRemaining','targetFactor','rateHP','rateHFP','generationDemand','distributionDemand','genPeakRate','genOffPeakRate','distPeakRate','distOffPeakRate','batteryEfficiency','chargeSource'];
const defaults={siteName:'Combapata',energyHP:356.91,maxDemand:3.48,hoursElapsed:125,hoursMonth:125,daysRemaining:0,targetFactor:.45,rateHP:.3373,rateHFP:.2831,generationDemand:3.48,distributionDemand:4.26,genPeakRate:61.06,genOffPeakRate:38.95,distPeakRate:26.01,distOffPeakRate:25.85,batteryEfficiency:.95,chargeSource:'solar'};
const nf=(n,d=2)=>Number(n).toLocaleString('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d});
const money=n=>`S/ ${nf(n)}`;
const num=id=>Number($(id).value)||0;

function initialPeriod(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function getData(){return Object.fromEntries(inputIds.map(id=>[id,$(id).type==='number'?num(id):$(id).value]))}
function factor(energy,hours,demand){return hours>0&&demand>0?energy/(hours*demand):0}
function stateFor(fc,target){if(fc<=target)return {label:'Dentro de meta',cls:'good'};if(fc<.5)return {label:'Fuera de meta',cls:'warn'};return {label:'Presente en punta',cls:'danger'}}

function calculate(){
 const d=getData();
 const elapsed=Math.max(1,d.hoursElapsed), total=Math.max(elapsed,d.hoursMonth);
 const rate=d.energyHP/elapsed;
 const projectedEnergy=d.energyHP+rate*(total-elapsed);
 const projected=factor(projectedEnergy,total,d.maxDemand);
 const current=factor(d.energyHP,elapsed,d.maxDemand);
 const targetEnergy=d.targetFactor*total*d.maxDemand;
 const margin=targetEnergy-projectedEnergy;
 const remainingPeakDays=Math.max(0,d.daysRemaining);
 const required=Math.max(0,-margin);
 const daily=remainingPeakDays?required/remainingPeakDays:required;
 const status=stateFor(projected,d.targetFactor);
 const energySavings=required*d.rateHP-(d.chargeSource==='grid'?required/Math.max(.01,d.batteryEfficiency)*d.rateHFP:0);
 const powerSavings=d.maxDemand>0?(d.generationDemand*(d.genPeakRate-d.genOffPeakRate)+d.distributionDemand*(d.distPeakRate-d.distOffPeakRate)):0;
 const savings=Math.max(0,(energySavings+powerSavings)*1.18);
 return {...d,elapsed,total,rate,projectedEnergy,projected,current,targetEnergy,margin,required,daily,status,savings,powerSavings,energySavings};
}

function render(){
 const r=calculate();
 $('siteNameDisplay').textContent=r.siteName||'Sin nombre';
 $('periodDisplay').textContent=r.period?new Date(`${r.period}-02`).toLocaleDateString('es-PE',{month:'long',year:'numeric'}):'Control operativo mensual';
 $('statusPill').textContent=r.status.label;$('statusPill').className=`status-pill ${r.status.cls}`;
 $('projectedFactor').textContent=nf(r.projected);$('targetFactorLabel').textContent=nf(r.targetFactor);
 $('trendText').textContent=r.projected>r.current?'Tendencia al alza':r.projected<r.current?'Tendencia a la baja':'Tendencia estable';
 $('gaugeFill').style.width=`${Math.min(100,r.projected*100)}%`;$('gaugeFill').style.background=r.status.cls==='good'?'#dff39c':r.status.cls==='warn'?'#f5b942':'#ef6b61';
 $('targetMarker').style.left=`${Math.min(100,r.targetFactor*100)}%`;
 $('energyNow').textContent=`${nf(r.energyHP)} kWh`;$('energyLimitText').textContent=`Límite al cierre: ${nf(r.targetEnergy)} kWh`;
 $('energyMargin').textContent=`${r.margin>=0?'+':''}${nf(r.margin)} kWh`;$('marginDays').textContent=r.margin>=0?'Margen antes de superar la meta':'Reducción adicional necesaria';
 $('dailyReduction').textContent=`${nf(r.daily)} kWh`;$('monthlySavings').textContent=money(r.savings);$('savingsMode').textContent=r.chargeSource==='solar'?'Carga solar y cambio de calificación':'Carga desde red y cambio de calificación';
 renderActions(r);renderScenarios(r);renderChart(r);renderHistory();
}

function renderActions(r){
 const actions=[];
 if(r.projected>=.5)actions.push(['danger','!','Reducir energía en punta',`Desplazar al menos ${nf(r.required)} kWh antes del cierre para llegar a ${nf(r.targetFactor)}.`]);
 else if(r.projected>r.targetFactor)actions.push(['warn','↓','Aplicar descarga correctiva',`Programar ${nf(r.daily)} kWh por cada día punta restante, entre 18:00 y 23:00.`]);
 else actions.push(['','✓','Mantener programación',`Existe un margen proyectado de ${nf(Math.max(0,r.margin))} kWh antes de superar la meta.`]);
 if(r.daysRemaining>0&&r.daily>0)actions.push(['','B','Reservar capacidad de batería',`Asegurar al inicio de punta al menos ${nf(r.daily/Math.max(.01,r.batteryEfficiency))} kWh almacenados.`]);
 if(r.current<r.targetFactor&&r.projected>r.targetFactor)actions.push(['warn','↗','Corregir tendencia',`El consumo medio actual es ${nf(r.rate)} kWh por hora punta y proyecta un cierre fuera de meta.`]);
 if(r.maxDemand<r.generationDemand*.9)actions.push(['warn','MD','Recalcular con la nueva demanda',`Una menor demanda máxima reduce el denominador del factor. Verificar el pico real del medidor.`]);
 actions.push(['','5m','Revisar telemetría',`Confirmar cada 5 minutos que el consumo de red permanezca bajo el límite operativo durante punta.`]);
 $('actionCount').textContent=actions.length;$('actionsList').innerHTML=actions.map(a=>`<div class="action ${a[0]}"><span class="action-icon">${a[1]}</span><div><b>${a[2]}</b><p>${a[3]}</p></div></div>`).join('');
}

function renderScenarios(r){
 const scenarios=[
  ['Sin corrección',r.projectedEnergy],
  ['Meta operativa',r.targetEnergy],
  ['Margen seguro 0,42',.42*r.total*r.maxDemand]
 ];
 $('scenarioRows').innerHTML=scenarios.map(([name,e])=>{const f=factor(e,r.total,r.maxDemand),s=stateFor(f,r.targetFactor);return `<tr><td>${name}</td><td>${nf(f)}</td><td>${nf(e)} kWh</td><td><span class="tag ${s.cls}">${s.label}</span></td></tr>`}).join('');
}

function renderChart(r){
 const svg=$('forecastChart'), W=760,H=230,p=34, max=Math.max(.6,r.current,r.projected);
 const y=v=>H-p-(v/max)*(H-2*p), x1=p,x2=W-p;
 const ticks=[0,.25,.45,.5,max].filter((v,i,a)=>v<=max&&!a.slice(0,i).some(q=>Math.abs(q-v)<.02));
 svg.innerHTML=`${ticks.map(t=>`<line x1="${p}" y1="${y(t)}" x2="${W-p}" y2="${y(t)}" stroke="#dce4df"/><text x="4" y="${y(t)+4}" font-size="11" fill="#65736f">${nf(t)}</text>`).join('')}<line x1="${x1}" y1="${y(r.targetFactor)}" x2="${x2}" y2="${y(r.targetFactor)}" stroke="#0f766e" stroke-dasharray="6 6"/><path d="M ${x1} ${y(r.current)} L ${x2} ${y(r.projected)}" fill="none" stroke="#17324d" stroke-width="5" stroke-linecap="round"/><circle cx="${x1}" cy="${y(r.current)}" r="7" fill="#39a88e"/><circle cx="${x2}" cy="${y(r.projected)}" r="8" fill="${r.status.cls==='danger'?'#c33c36':r.status.cls==='warn'?'#d97706':'#0f766e'}"/><text x="${x1}" y="${H-6}" font-size="12" fill="#65736f">Lectura actual</text><text x="${x2-72}" y="${H-6}" font-size="12" fill="#65736f">Cierre estimado</text>`;
}

function save(){const r=calculate();localStorage.setItem('fc-settings',JSON.stringify(getData()));const h=JSON.parse(localStorage.getItem('fc-history')||'[]');h.unshift({date:new Date().toISOString(),period:r.period,energy:r.energyHP,demand:r.maxDemand,factor:r.projected,status:r.status.label,cls:r.status.cls});localStorage.setItem('fc-history',JSON.stringify(h.slice(0,12)));render();$('saveBtn').textContent='Guardado';setTimeout(()=>$('saveBtn').textContent='Guardar datos',1200)}
function renderHistory(){const h=JSON.parse(localStorage.getItem('fc-history')||'[]');$('historyRows').innerHTML=h.length?h.map(v=>`<tr><td>${new Date(v.date).toLocaleDateString('es-PE')}</td><td>${v.period||'—'}</td><td>${nf(v.energy)} kWh</td><td>${nf(v.demand)} kW</td><td>${nf(v.factor)}</td><td><span class="tag ${v.cls}">${v.status}</span></td></tr>`).join(''):`<tr><td colspan="6" class="empty">Aún no hay registros guardados.</td></tr>`}
function load(data){inputIds.forEach(id=>{if(data[id]!==undefined)$(id).value=data[id]});render()}
function reset(){localStorage.removeItem('fc-settings');load({...defaults,period:initialPeriod()})}

inputIds.forEach(id=>$(id).addEventListener('input',render));$('saveBtn').addEventListener('click',save);$('resetBtn').addEventListener('click',reset);$('clearHistoryBtn').addEventListener('click',()=>{localStorage.removeItem('fc-history');renderHistory()});
const saved=JSON.parse(localStorage.getItem('fc-settings')||'null');load(saved||{...defaults,period:initialPeriod()});

// Navegación entre opciones tarifarias
document.querySelectorAll('.tariff-tab').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('.tariff-tab').forEach(item=>item.classList.toggle('active',item===button));
 document.querySelectorAll('.tab-panel').forEach(panel=>{const active=panel.id===button.dataset.tab;panel.hidden=!active;panel.classList.toggle('active',active)});
 localStorage.setItem('tariff-active-tab',button.dataset.tab);
}));
const activeTab=localStorage.getItem('tariff-active-tab');
if(activeTab){const tab=document.querySelector(`[data-tab="${activeTab}"]`);if(tab)tab.click()}

const bt3Ids=['bt3Site','bt3Period','bt3EnergyHP','bt3Demand','bt3HoursElapsed','bt3HoursMonth','bt3DaysRemaining','bt3Target'];
const bt5Ids=['bt5Site','bt5Period','bt5UserType','bt5Energy','bt5DaysElapsed','bt5DaysMonth','bt5Target','bt5Budget','bt5Fixed','bt5Rate','bt5Other','bt5Tax'];
const values=ids=>Object.fromEntries(ids.map(id=>[id,$(id).type==='number'?num(id):$(id).value]));
const actionMarkup=items=>items.map(a=>`<div class="action ${a[0]}"><span class="action-icon">${a[1]}</span><div><b>${a[2]}</b><p>${a[3]}</p></div></div>`).join('');

function calculateBT3(){
 const d=values(bt3Ids),elapsed=Math.max(1,d.bt3HoursElapsed),total=Math.max(elapsed,d.bt3HoursMonth);
 const projected=d.bt3EnergyHP/elapsed*total,targetEnergy=d.bt3Target*total*d.bt3Demand,fc=factor(projected,total,d.bt3Demand);
 const required=Math.max(0,projected-targetEnergy),daily=d.bt3DaysRemaining?required/d.bt3DaysRemaining:required,status=stateFor(fc,d.bt3Target);
 return {...d,projected,targetEnergy,fc,required,daily,status};
}
function renderBT3(){
 const r=calculateBT3();
 $('bt3Factor').textContent=nf(r.fc);$('bt3TargetLabel').textContent=nf(r.bt3Target);$('bt3ProjectedEnergy').textContent=`${nf(r.projected)} kWh`;
 $('bt3EnergyLimit').textContent=`Límite: ${nf(r.targetEnergy)} kWh`;$('bt3Reduction').textContent=`${nf(r.required)} kWh`;$('bt3Daily').textContent=`${nf(r.daily)} kWh`;
 $('bt3State').textContent=r.status.label;$('bt3State').className=r.status.cls;$('bt3Trend').textContent=r.fc>r.bt3Target?'Se requiere corrección':'Proyección bajo control';
 const actions=[];
 if(r.fc>=.5)actions.push(['danger','!','Evitar calificación presente en punta',`Reducir ${nf(r.required)} kWh en las horas punta restantes.`]);
 else if(r.fc>r.bt3Target)actions.push(['warn','↓','Programar descarga',`Entregar ${nf(r.daily)} kWh por día punta para alcanzar un factor ${nf(r.bt3Target)}.`]);
 else actions.push(['','✓','Mantener el plan',`La proyección conserva un margen de ${nf(Math.max(0,r.targetEnergy-r.projected))} kWh.`]);
 actions.push(['','MD','Vigilar máxima demanda','Si cambia la demanda máxima, recalcular inmediatamente la meta de energía HP.']);
 actions.push(['','5m','Validar durante punta','Revisar la lectura entre 18:00 y 23:00 y registrar cualquier desviación.']);
 $('bt3ActionCount').textContent=actions.length;$('bt3Actions').innerHTML=actionMarkup(actions);
}
function saveBT3(){localStorage.setItem('bt3-settings',JSON.stringify(values(bt3Ids)));renderBT3();$('bt3Save').textContent='Guardado';setTimeout(()=>$('bt3Save').textContent='Guardar BT3',1200)}

function calculateBT5(){
 const d=values(bt5Ids),elapsed=Math.max(1,d.bt5DaysElapsed),total=Math.max(elapsed,d.bt5DaysMonth),remaining=Math.max(0,total-elapsed);
 const projected=d.bt5Energy/elapsed*total,margin=d.bt5Target-projected,reduction=Math.max(0,-margin),dailyLimit=remaining?Math.max(0,(d.bt5Target-d.bt5Energy)/remaining):0;
 const subtotal=d.bt5Fixed+projected*d.bt5Rate+d.bt5Other,cost=subtotal*(1+d.bt5Tax),overBudget=Math.max(0,cost-d.bt5Budget);
 return {...d,projected,margin,reduction,dailyLimit,cost,overBudget,remaining};
}
function renderBT5(){
 const r=calculateBT5(),consumptionClass=r.projected<=r.bt5Target?'good':r.projected<=r.bt5Target*1.1?'warn':'danger',costClass=r.cost<=r.bt5Budget?'good':r.cost<=r.bt5Budget*1.1?'warn':'danger';
 $('bt5Cost').textContent=money(r.cost);$('bt5Cost').className=costClass;$('bt5CostState').textContent=r.cost<=r.bt5Budget?'Dentro del presupuesto':`Exceso estimado: ${money(r.overBudget)}`;
 $('bt5Projected').textContent=`${nf(r.projected)} kWh`;$('bt5ConsumptionState').textContent=`Meta: ${nf(r.bt5Target)} kWh`;$('bt5Margin').textContent=`${r.margin>=0?'+':''}${nf(r.margin)} kWh`;
 $('bt5DailyLimit').textContent=`${nf(r.dailyLimit)} kWh`;$('bt5Reduction').textContent=`${nf(r.reduction)} kWh`;
 const actions=[];
 if(r.projected>r.bt5Target)actions.push(['danger','↓','Reducir consumo diario',`La proyección supera la meta en ${nf(r.reduction)} kWh. Apagar o reprogramar cargas no esenciales.`]);
 else actions.push(['','✓','Consumo dentro de meta',`Se dispone de ${nf(Math.max(0,r.margin))} kWh de margen proyectado.`]);
 if(r.cost>r.bt5Budget)actions.push(['warn','S/','Ajustar presupuesto o consumo',`El recibo proyectado excede el presupuesto en ${money(r.overBudget)}.`]);
 if(r.bt5UserType==='residential'&&r.projected>140)actions.push(['warn','140','Revisar tramo residencial','El consumo proyectado supera 140 kWh. Verificar el tratamiento FOSE y el precio aplicable del pliego.']);
 actions.push(['','24h','Registrar lectura diaria',`Consumir como máximo ${nf(r.dailyLimit)} kWh por día durante los ${r.remaining} días restantes.`]);
 $('bt5ActionCount').textContent=actions.length;$('bt5Actions').innerHTML=actionMarkup(actions);
}
function saveBT5(){localStorage.setItem('bt5-settings',JSON.stringify(values(bt5Ids)));renderBT5();$('bt5Save').textContent='Guardado';setTimeout(()=>$('bt5Save').textContent='Guardar BT5B',1200)}

bt3Ids.forEach(id=>$(id).addEventListener('input',renderBT3));bt5Ids.forEach(id=>$(id).addEventListener('input',renderBT5));
$('bt3Save').addEventListener('click',saveBT3);$('bt5Save').addEventListener('click',saveBT5);
const bt3Saved=JSON.parse(localStorage.getItem('bt3-settings')||'null');if(bt3Saved)bt3Ids.forEach(id=>{if(bt3Saved[id]!==undefined)$(id).value=bt3Saved[id]});else $('bt3Period').value=initialPeriod();
const bt5Saved=JSON.parse(localStorage.getItem('bt5-settings')||'null');if(bt5Saved)bt5Ids.forEach(id=>{if(bt5Saved[id]!==undefined)$(id).value=bt5Saved[id]});else $('bt5Period').value=initialPeriod();
renderBT3();renderBT5();

// Centro documental y análisis de curva AC
let curveData=[];
let curveSummary=null;
const dbPromise=new Promise((resolve,reject)=>{
 const request=indexedDB.open('control-tarifario-files',1);
 request.onupgradeneeded=()=>{
  const db=request.result;
  if(!db.objectStoreNames.contains('receipts')){const store=db.createObjectStore('receipts',{keyPath:'id',autoIncrement:true});store.createIndex('tariff','tariff')}
  if(!db.objectStoreNames.contains('curves'))db.createObjectStore('curves',{keyPath:'tariff'});
 };
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
function dbAction(storeName,mode,work){return dbPromise.then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(storeName,mode),store=tx.objectStore(storeName),request=work(store);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}))}
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selectedTariff=()=>$('dataTariff').value;
function activeTarget(tariff){return tariff==='MT3'?num('targetFactor'):tariff==='BT3'?num('bt3Target'):num('curveTarget')||.45}
function syncCurveTarget(){const tariff=selectedTariff();if(tariff==='MT3')$('curveTarget').value=num('targetFactor');if(tariff==='BT3')$('curveTarget').value=num('bt3Target')}

const receiptNumber=value=>{const parsed=Number(String(value??'').replace(/\s/g,'').replace(/,/g,''));return Number.isFinite(parsed)?parsed:null};
const firstMatch=(text,pattern)=>{const match=text.match(pattern);return match?match[1]:null};
function receiptPeriod(value){
 const raw=String(value||'').trim(),compact=raw.match(/(20\d{2})(0[1-9]|1[0-2])/);if(compact)return `${compact[1]}-${compact[2]}`;
 const months={enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',setiembre:'09',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'},match=raw.toLowerCase().match(/([a-záéíóú]+)[-\s]+(20\d{2})/);return match&&months[match[1]]?`${match[2]}-${months[match[1]]}`:'';
}
async function extractPdfText(file){
 const pdfjs=await import('./vendor/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',document.baseURI).href;
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;let text='';
 for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){const page=await pdf.getPage(pageNumber),content=await page.getTextContent();text+=content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('')+'\n'}return text;
}
function parseDemandFromConsumption(text){const line=firstMatch(text,/ConsumoTotal\s+([^\n]+)/i);if(!line)return null;const values=(line.match(/[\d,.]+/g)||[]).map(receiptNumber).filter(Number.isFinite);return values.length>=4?Math.max(values[2],values[3]):null}
function parseBilledLine(text,label){const pattern=new RegExp(label+'[^\\n]*?([\\d,.]+)\\s+kW\\.?h\\s+([\\d,.]+)','i'),match=text.match(pattern);return match?{energy:receiptNumber(match[1]),rate:receiptNumber(match[2])}:null}
function parseReceipt(text,fileName){
 const tariff=(firstMatch(text,/(?:Opcion\s+Tarifaria|TARIFA)\s+(MT3|BT3|BT5B)/i)||'').toUpperCase();if(!tariff)throw new Error('No se pudo identificar la tarifa MT3, BT3 o BT5B.');
 const site=fileName.replace(/\.[^.]+$/,'').replace(/^\d+_[A-Z]{2}_/i,'').replace(/_/g,' '),periodText=firstMatch(text,/MES\s+FACTURADO\s*:?[\s]*([A-Za-zÁÉÍÓÚáéíóú]+-20\d{2}|20\d{4})/i),period=receiptPeriod(periodText);
 const total=receiptNumber(firstMatch(text,/(?:TOTAL\s+A\s+PAGAR\s+S\/\s*:|TOTAL\s+MES|TOTAL\s+S\/\.?)\s*\**\s*([\d,.]+)/i)),fixed=receiptNumber(firstMatch(text,/CARGO\s+FIJO\s+([\d,.]+)/i));
 if(tariff==='BT5B')return {tariff,site,period,total,fixed,energy:receiptNumber(firstMatch(text,/CONSUMO\s+FACTURADO\s+([\d,.]+)\s*kWh/i)),rate:receiptNumber(firstMatch(text,/COSTO\s+DE\s+kW\.h\s+ES:\s*S\/\s*([\d,.]+)/i))};
 const billedHP=parseBilledLine(text,'ENERGIA\\s+HORA\\s+PUNTA'),billedHFP=parseBilledLine(text,'ENERGIA\\s+HORA\\s+FUERA\\s+PUNTA');
 const energyHP=receiptNumber(firstMatch(text,/Energia\s+Hora\s+Punta\s+([\d,.]+)\s*KWH/i))??billedHP?.energy;
 const hours=receiptNumber(firstMatch(text,/(?:Horas\s+Hora\s+Punta\s+del\s+mes|N\S*\s*Horas\s+Punta)\s+([\d,.]+)/i));
 const demand=receiptNumber(firstMatch(text,/Maxima\s+Demanda\s+del\s+Mes\s+([\d,.]+)\s*KW/i))??parseDemandFromConsumption(text);
 const statedFactor=receiptNumber(firstMatch(text,/(?:Grado\s+de\s+Utilizaci\S*|Calificacion)\s+([\d,.]+)/i));
 return {tariff,site,period,total,fixed,energyHP,energyHFP:billedHFP?.energy,hours,demand,statedFactor,rateHP:billedHP?.rate,rateHFP:billedHFP?.rate};
}
function activateTariff(tariff){const button=[...document.querySelectorAll('.tariff-tab')].find(item=>item.textContent.trim()===tariff);if(button)button.click()}
function applyReceiptData(data){
 activateTariff(data.tariff);
 if(data.tariff==='MT3'){
  if(data.site)$('siteName').value=data.site;if(data.period)$('period').value=data.period;if(data.energyHP!=null)$('energyHP').value=data.energyHP;if(data.demand!=null){$('maxDemand').value=data.demand;$('generationDemand').value=data.demand}if(data.hours!=null){$('hoursElapsed').value=data.hours;$('hoursMonth').value=data.hours;$('daysRemaining').value=0}if(data.rateHP!=null)$('rateHP').value=data.rateHP;if(data.rateHFP!=null)$('rateHFP').value=data.rateHFP;localStorage.setItem('fc-settings',JSON.stringify(getData()));render();
 }else if(data.tariff==='BT3'){
  if(data.site)$('bt3Site').value=data.site;if(data.period)$('bt3Period').value=data.period;if(data.energyHP!=null)$('bt3EnergyHP').value=data.energyHP;if(data.demand!=null)$('bt3Demand').value=data.demand;if(data.hours!=null){$('bt3HoursElapsed').value=data.hours;$('bt3HoursMonth').value=data.hours;$('bt3DaysRemaining').value=0}localStorage.setItem('bt3-settings',JSON.stringify(values(bt3Ids)));renderBT3();
 }else{
  if(data.site)$('bt5Site').value=data.site;if(data.period)$('bt5Period').value=data.period;if(data.energy!=null)$('bt5Energy').value=data.energy;if(data.rate!=null)$('bt5Rate').value=data.rate;if(data.fixed!=null)$('bt5Fixed').value=data.fixed;
  if(data.period){const [year,month]=data.period.split('-').map(Number),days=new Date(year,month,0).getDate();$('bt5DaysElapsed').value=days;$('bt5DaysMonth').value=days}if(data.total!=null&&data.energy!=null&&data.rate!=null){$('bt5Other').value=Math.max(0,data.total/1.18-(data.fixed||0)-data.energy*data.rate).toFixed(2)}localStorage.setItem('bt5-settings',JSON.stringify(values(bt5Ids)));renderBT5();
 }
 syncCurveTarget();return [data.tariff,data.site,data.period,data.energyHP??data.energy,data.demand,data.hours].filter(v=>v!==null&&v!=='').join(' · ');
}

async function saveReceipts(files){
 const tariff=selectedTariff(),valid=[...files].filter(file=>file.size<=10*1024*1024&&['application/pdf','image/jpeg','image/png'].includes(file.type));
 if(!valid.length){$('uploadMessage').textContent='No se encontraron archivos válidos o alguno supera 10 MB.';return}
 let processed='';for(const file of valid){let detectedTariff=tariff;if(file.type==='application/pdf'){try{const data=parseReceipt(await extractPdfText(file),file.name);detectedTariff=data.tariff;processed=applyReceiptData(data)}catch(error){processed=`Guardado sin actualización automática: ${error.message}`}}await dbAction('receipts','readwrite',store=>store.add({tariff:detectedTariff,name:file.name,type:file.type,size:file.size,createdAt:new Date().toISOString(),blob:file}))}
 $('uploadMessage').textContent=processed?`Recibo procesado: ${processed}`:`${valid.length} archivo(s) guardado(s). Para actualización automática utilice PDF con texto.`;await renderReceipts();$('receiptFiles').value='';
}
async function renderReceipts(){
 const tariff=selectedTariff(),all=await dbAction('receipts','readonly',store=>store.getAll()),items=all.filter(item=>item.tariff===tariff);
 $('receiptList').innerHTML=items.length?items.map(item=>`<div class="attachment"><a href="#" data-open-receipt="${item.id}">${safe(item.name)}</a><small>${nf(item.size/1024,0)} KB</small><button type="button" data-delete-receipt="${item.id}" aria-label="Eliminar ${safe(item.name)}">×</button></div>`).join(''):`<span class="empty">No hay recibos adjuntos para ${tariff}.</span>`;
}
async function openReceipt(id){const item=await dbAction('receipts','readonly',store=>store.get(Number(id)));if(!item)return;const url=URL.createObjectURL(item.blob),link=document.createElement('a');link.href=url;link.target='_blank';link.download=item.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function deleteReceipt(id){await dbAction('receipts','readwrite',store=>store.delete(Number(id)));await renderReceipts();$('uploadMessage').textContent='Recibo eliminado del almacenamiento local.'}

const cleanCell=value=>String(value??'').trim().replace(/^"|"$/g,'');
function cellDate(value){if(value instanceof Date)return value;const text=cleanCell(value),iso=text.match(/^\d{4}-\d{2}-\d{2}/)?text.replace(' ','T'):text;return new Date(iso)}
function matrixToCurve(rows){
 const headerRow=rows.findIndex(row=>{const cells=row.map(v=>cleanCell(v).toLowerCase());return cells.some(v=>/start\s*time|fecha[_\s-]*hora|timestamp|date.*time/.test(v))&&cells.some(v=>/energy\s*consumption\s*per\s*hour|kwh|energ/.test(v))});
 if(headerRow<0)throw new Error('No se encontró una tabla con Start Time y Energy Consumption per Hour (kWh).');
 const headers=rows[headerRow].map(v=>cleanCell(v).toLowerCase()),dateIndex=headers.findIndex(v=>/start\s*time|fecha[_\s-]*hora|timestamp|date.*time/.test(v));
 let energyIndex=headers.findIndex(v=>/energy\s*consumption\s*per\s*hour/.test(v));if(energyIndex<0)energyIndex=headers.findIndex(v=>/kwh|energ/.test(v)&&!/total|acumul/.test(v));
 if(dateIndex<0||energyIndex<0)throw new Error('No se identificaron las columnas de fecha y consumo horario.');
 const points=rows.slice(headerRow+1).map(row=>{const date=cellDate(row[dateIndex]),raw=cleanCell(row[energyIndex]).replace(',','.'),value=Number(raw);return {date,value}}).filter(p=>!Number.isNaN(p.date.getTime())&&Number.isFinite(p.value)&&p.value>=0).sort((a,b)=>a.date-b.date);
 if(points.length<2)throw new Error('Se requieren al menos dos registros válidos.');return points;
}
function parseCurve(text){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());if(lines.length<2)throw new Error('El CSV no contiene datos.');
 const sample=lines.slice(0,12).join('\n'),counts={';':(sample.match(/;/g)||[]).length,',':(sample.match(/,/g)||[]).length,'\t':(sample.match(/\t/g)||[]).length},delimiter=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
 return matrixToCurve(lines.map(line=>line.split(delimiter)));
}
async function parseCurveFile(file){
 if(/\.xlsx?$/i.test(file.name)||/\.xls$/i.test(file.name)){
  if(typeof XLSX==='undefined')throw new Error('No se pudo cargar el lector de Excel. Compruebe la conexión e inténtelo nuevamente.');
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}),sheet=workbook.Sheets[workbook.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',dateNF:'yyyy-mm-dd hh:mm:ss'});return matrixToCurve(rows);
 }
 return parseCurve(await file.text());
}
function inferInterval(points){const gaps=[];for(let i=1;i<Math.min(points.length,200);i++){const gap=(points[i].date-points[i-1].date)/60000;if(gap>0&&gap<=1440)gaps.push(gap)}return gaps.length?gaps.sort((a,b)=>a-b)[Math.floor(gaps.length/2)]:num('curveInterval')}
function summarizeCurve(){
 if(!curveData.length)return null;const inferred=inferInterval(curveData),interval=inferred||Math.max(1,num('curveInterval')),hours=interval/60,start=num('peakStart'),end=num('peakEnd');
 const peakPoints=curveData.filter(p=>{const h=p.date.getHours()+p.date.getMinutes()/60;return start<end?h>=start&&h<end:h>=start||h<end});
 const total=curveData.reduce((sum,p)=>sum+p.value,0),peakEnergy=peakPoints.reduce((sum,p)=>sum+p.value,0),peakHours=peakPoints.length*hours,demand=Math.max(...curveData.map(p=>p.value/hours)),fc=factor(peakEnergy,peakHours,demand),target=num('curveTarget')||activeTarget(selectedTariff());
 return {interval,total,peakEnergy,peakHours,demand,fc,target,status:stateFor(fc,target),points:curveData.length};
}
function drawACChart(){
 const svg=$('acCurveChart'),W=1000,H=300,p=44;if(!curveData.length){svg.innerHTML='<text x="500" y="150" text-anchor="middle" fill="#65736f">Cargue una curva Excel o CSV para visualizar el suministro</text>';return}
 const step=Math.max(1,Math.ceil(curveData.length/500)),data=curveData.filter((_,i)=>i%step===0||i===curveData.length-1),max=Math.max(...data.map(v=>v.value),.01),x=i=>p+i*(W-2*p)/Math.max(1,data.length-1),y=v=>H-p-v/max*(H-2*p),path=data.map((v,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(v.value).toFixed(1)}`).join(' ');
 svg.innerHTML=`<line x1="${p}" y1="${H-p}" x2="${W-p}" y2="${H-p}" stroke="#cfdad5"/><line x1="${p}" y1="${p}" x2="${p}" y2="${H-p}" stroke="#cfdad5"/><path d="${path}" fill="none" stroke="#0f766e" stroke-width="3"/><path d="${path} L ${W-p} ${H-p} L ${p} ${H-p} Z" fill="rgba(57,168,142,.10)"/><text x="4" y="${p+4}" fill="#65736f" font-size="12">${nf(max)} kWh</text><text x="${p}" y="${H-10}" fill="#65736f" font-size="12">${data[0].date.toLocaleString('es-PE')}</text><text x="${W-p}" y="${H-10}" text-anchor="end" fill="#65736f" font-size="12">${data[data.length-1].date.toLocaleString('es-PE')}</text>`;
}
function renderCurve(){
 curveSummary=summarizeCurve();drawACChart();$('applyCurveBtn').disabled=!curveSummary;
 if(!curveSummary){['curveTotal','curvePeakEnergy','curveDemand','curveFactor'].forEach(id=>$(id).textContent='—');$('curvePoints').textContent='Sin curva cargada';return}
 const r=curveSummary,referential=selectedTariff()==='BT5B';$('curveInterval').value=nf(r.interval,0);$('curveTotal').textContent=`${nf(r.total)} kWh`;$('curvePoints').textContent=`${r.points} intervalos analizados`;$('curvePeakEnergy').textContent=`${nf(r.peakEnergy)} kWh`;$('curvePeakHours').textContent=`${nf(r.peakHours)} horas dentro de HP`;$('curveDemand').textContent=`${nf(r.demand)} kW`;$('curveFactor').textContent=nf(r.fc);$('curveFactor').className=r.status.cls;$('curveFactorStatus').textContent=`Objetivo: ${nf(r.target)}${referential?' · referencial':''}`;
 const ok=r.fc<=r.target,box=$('curveValidation');box.className=`curve-validation ${ok?'good':r.status.cls}`;box.innerHTML=`<span class="status-pill ${ok?'good':r.status.cls}">${ok?'Objetivo validado':'Requiere acción'}</span><h3>${ok?'La curva cumple la meta':'El factor supera la meta'}</h3><p>${referential?'En BT5B este factor es un indicador operativo y no determina la facturación. ':''}${ok?`Existe un margen de ${nf(r.target-r.fc)}.`:`Reduzca energía en punta o aumente el desplazamiento de carga. Diferencia: ${nf(r.fc-r.target)}.`}</p>`;
}
async function loadCurve(){const record=await dbAction('curves','readonly',store=>store.get(selectedTariff()));curveData=(record?.points||[]).map(p=>({date:new Date(p.date),value:p.value}));if(record?.target)$('curveTarget').value=record.target;renderCurve()}
async function importCurve(file){try{curveData=await parseCurveFile(file);const interval=inferInterval(curveData);$('curveInterval').value=nf(interval,0);const points=curveData.map(p=>({date:p.date.toISOString(),value:p.value}));await dbAction('curves','readwrite',store=>store.put({tariff:selectedTariff(),name:file.name,target:num('curveTarget'),points,updatedAt:new Date().toISOString()}));$('uploadMessage').textContent=`Curva ${file.name} cargada: ${points.length} intervalos de ${nf(interval,0)} minutos.`;renderCurve()}catch(error){$('uploadMessage').textContent=error.message}finally{$('curveFile').value=''}}
function applyCurve(){if(!curveSummary)return;const r=curveSummary,tariff=selectedTariff();if(tariff==='MT3'){$('energyHP').value=r.peakEnergy;$('maxDemand').value=r.demand;$('hoursElapsed').value=r.peakHours;$('targetFactor').value=r.target;render()}else if(tariff==='BT3'){$('bt3EnergyHP').value=r.peakEnergy;$('bt3Demand').value=r.demand;$('bt3HoursElapsed').value=r.peakHours;$('bt3Target').value=r.target;renderBT3()}else{$('bt5Energy').value=r.total;renderBT5()}$('uploadMessage').textContent=`Lectura de curva aplicada al módulo ${tariff}.`}

$('receiptFiles').addEventListener('change',event=>saveReceipts(event.target.files));$('curveFile').addEventListener('change',event=>event.target.files[0]&&importCurve(event.target.files[0]));
$('receiptList').addEventListener('click',event=>{const open=event.target.closest('[data-open-receipt]'),del=event.target.closest('[data-delete-receipt]');if(open){event.preventDefault();openReceipt(open.dataset.openReceipt)}if(del)deleteReceipt(del.dataset.deleteReceipt)});
$('dataTariff').addEventListener('change',async()=>{syncCurveTarget();await Promise.all([renderReceipts(),loadCurve()])});['curveInterval','peakStart','peakEnd','curveTarget'].forEach(id=>$(id).addEventListener('input',renderCurve));$('applyCurveBtn').addEventListener('click',applyCurve);
document.querySelectorAll('.tariff-tab').forEach(button=>button.addEventListener('click',()=>{const tariff=button.textContent.trim();$('dataTariff').value=tariff;syncCurveTarget();renderReceipts();loadCurve()}));
syncCurveTarget();renderReceipts();loadCurve();
