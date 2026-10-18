const $=id=>document.getElementById(id);
const inputIds=['siteName','period','energyHP','maxDemand','hoursElapsed','hoursMonth','daysRemaining','targetFactor','rateHP','rateHFP','generationDemand','distributionDemand','genPeakRate','genOffPeakRate','distPeakRate','distOffPeakRate','batteryEfficiency','chargeSource'];
const defaults={siteName:'Combapata',energyHP:356.91,maxDemand:3.48,hoursElapsed:125,hoursMonth:125,daysRemaining:0,targetFactor:.45,rateHP:.3373,rateHFP:.2831,generationDemand:3.48,distributionDemand:4.26,genPeakRate:61.06,genOffPeakRate:38.95,distPeakRate:26.01,distOffPeakRate:25.85,batteryEfficiency:.95,chargeSource:'solar'};
const nf=(n,d=2)=>Number(n).toLocaleString('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d});
const money=n=>`S/ ${nf(n)}`;
const num=id=>Number($(id).value)||0;

function initialPeriod(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function getData(){return Object.fromEntries(inputIds.map(id=>[id,$(id).type==='number'?num(id):$(id).value]))}
function factor(energy,hours,demand){return hours>0&&demand>0?energy/(hours*demand):0}
function stateFor(fc,target){if(fc<=target+.0005)return {label:'Dentro de meta',cls:'good'};if(fc<.5)return {label:'Fuera de meta',cls:'warn'};return {label:'Presente en punta',cls:'danger'}}

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
const mt4Ids=['mt4Site','mt4Period','mt4EnergyTotal','mt4EnergyHP','mt4Demand','mt4HoursElapsed','mt4HoursMonth','mt4DaysRemaining','mt4Target','mt4EnergyRate','mt4DistDemand','mt4DistRate','mt4GenDemand','mt4GenRate','mt4Other','mt4Tax','mt4NonTaxed'];
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

function calculateMT4(){
 const d=values(mt4Ids),elapsed=Math.max(1,d.mt4HoursElapsed),total=Math.max(elapsed,d.mt4HoursMonth),projectedHP=d.mt4EnergyHP/elapsed*total;
 const targetEnergy=d.mt4Target*total*d.mt4Demand,fc=factor(projectedHP,total,d.mt4Demand),required=Math.max(0,projectedHP-targetEnergy),daily=d.mt4DaysRemaining?required/d.mt4DaysRemaining:required,status=stateFor(fc,d.mt4Target);
 const subtotal=d.mt4EnergyTotal*d.mt4EnergyRate+d.mt4DistDemand*d.mt4DistRate+d.mt4GenDemand*d.mt4GenRate+d.mt4Other,cost=subtotal*(1+d.mt4Tax)+d.mt4NonTaxed;
 return {...d,projectedHP,targetEnergy,fc,required,daily,status,subtotal,cost};
}
function renderMT4(){
 const r=calculateMT4();$('mt4Factor').textContent=nf(r.fc);$('mt4TargetLabel').textContent=nf(r.mt4Target);$('mt4ProjectedHP').textContent=`${nf(r.projectedHP)} kWh`;$('mt4EnergyLimit').textContent=`Límite: ${nf(r.targetEnergy)} kWh`;$('mt4Reduction').textContent=`${nf(r.required)} kWh`;$('mt4Cost').textContent=money(r.cost);$('mt4CostDetail').textContent=`Subtotal estimado: ${money(r.subtotal)}`;$('mt4State').textContent=r.status.label;$('mt4State').className=r.status.cls;$('mt4Trend').textContent=r.fc<.5?'Usuario presente fuera de punta':'Usuario presente en punta';
 const actions=[];if(r.fc>=.5)actions.push(['danger','!','Cambiar la calificación','Reducir el uso en hora punta para quedar por debajo de 0,50.']);else if(r.fc>r.mt4Target)actions.push(['warn','↓','Alcanzar la meta operativa',`Reducir ${nf(r.required)} kWh; equivalente a ${nf(r.daily)} kWh por día punta restante.`]);else actions.push(['','✓','Mantener condición fuera de punta',`La energía HP proyectada conserva un margen de ${nf(Math.max(0,r.targetEnergy-r.projectedHP))} kWh.`]);actions.push(['','MD','Vigilar la demanda máxima','Una disminución de la demanda máxima también reduce el denominador del factor.']);actions.push(['','S/','Actualizar cargos','Contrastar los precios de energía, distribución y generación con el pliego vigente.']);$('mt4ActionCount').textContent=actions.length;$('mt4Actions').innerHTML=actionMarkup(actions);
}
function saveMT4(){localStorage.setItem('mt4-settings',JSON.stringify(values(mt4Ids)));renderMT4();$('mt4Save').textContent='Guardado';setTimeout(()=>$('mt4Save').textContent='Guardar MT4',1200)}

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

bt3Ids.forEach(id=>$(id).addEventListener('input',renderBT3));mt4Ids.forEach(id=>$(id).addEventListener('input',()=>{renderMT4();renderBatteryComparison()}));bt5Ids.forEach(id=>$(id).addEventListener('input',renderBT5));
$('bt3Save').addEventListener('click',saveBT3);$('mt4Save').addEventListener('click',saveMT4);$('bt5Save').addEventListener('click',saveBT5);
const bt3Saved=JSON.parse(localStorage.getItem('bt3-settings')||'null');if(bt3Saved)bt3Ids.forEach(id=>{if(bt3Saved[id]!==undefined)$(id).value=bt3Saved[id]});else $('bt3Period').value=initialPeriod();
const mt4Saved=JSON.parse(localStorage.getItem('mt4-settings')||'null');if(mt4Saved)mt4Ids.forEach(id=>{if(mt4Saved[id]!==undefined)$(id).value=mt4Saved[id]});
const bt5Saved=JSON.parse(localStorage.getItem('bt5-settings')||'null');if(bt5Saved)bt5Ids.forEach(id=>{if(bt5Saved[id]!==undefined)$(id).value=bt5Saved[id]});else $('bt5Period').value=initialPeriod();
renderBT3();renderMT4();renderBT5();

// Centro documental y análisis de curva AC
let curveSets={before:[],after:[],pv:[]};
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
const factorApplicable=()=>['BT3','MT3','MT4'].includes(selectedTariff());
function renderTariffWorkflow(){
 const tariff=selectedTariff(),applies=factorApplicable();document.querySelectorAll('.factor-only').forEach(el=>el.classList.toggle('is-hidden',!applies));$('bt5bEnergyPath').classList.toggle('is-hidden',applies);['workflowStep2','workflowStep3','workflowStep4'].forEach(id=>$(id).classList.toggle('disabled',!applies));
 if(applies){$('workflowDecision').textContent=`${tariff}: sí evalúa factor de calificación`;$('workflowExplanation').textContent='La ruta continúa con energía en hora punta, batería óptima y paneles para la recarga.';$('workflowBadge').textContent='Factor aplicable';$('workflowBadge').className='status-pill good'}else{$('workflowDecision').textContent='BT5B: no evalúa factor de calificación';$('workflowExplanation').textContent='La ruta termina en consumo mensual y costo. No se dimensionan baterías para modificar el factor.';$('workflowBadge').textContent='Solo energía y costo';$('workflowBadge').className='status-pill warn'}
}
function activeTarget(tariff){return tariff==='MT3'?num('targetFactor'):tariff==='MT4'?num('mt4Target'):tariff==='BT3'?num('bt3Target'):num('curveTarget')||.45}
function syncCurveTarget(){const tariff=selectedTariff();if(tariff==='MT3')$('curveTarget').value=num('targetFactor');if(tariff==='MT4')$('curveTarget').value=num('mt4Target');if(tariff==='BT3')$('curveTarget').value=num('bt3Target')}

const receiptNumber=value=>{if(value===null||value===undefined||String(value).trim()==='')return null;const parsed=Number(String(value).replace(/\s/g,'').replace(/,/g,''));return Number.isFinite(parsed)?parsed:null};
const firstMatch=(text,pattern)=>{const match=text.match(pattern);return match?match[1]:null};
function receiptPeriod(value){
 const raw=String(value||'').trim(),compact=raw.match(/(20\d{2})(0[1-9]|1[0-2])/);if(compact)return `${compact[1]}-${compact[2]}`;
 const months={enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',setiembre:'09',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'},match=raw.toLowerCase().match(/([a-záéíóú]+)[-\s]+(20\d{2})/);return match&&months[match[1]]?`${match[2]}-${months[match[1]]}`:'';
}
async function extractPdfText(file){
 const pdfjs=await import('./vendor/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',document.baseURI).href;
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;let text='';
 for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){const page=await pdf.getPage(pageNumber),content=await page.getTextContent(),lines=[];for(const item of content.items){const y=item.transform?.[5]||0,x=item.transform?.[4]||0;let line=lines.find(row=>Math.abs(row.y-y)<2);if(!line){line={y,items:[]};lines.push(line)}line.items.push({x,text:item.str})}lines.sort((a,b)=>b.y-a.y);text+=lines.map(line=>line.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ').replace(/\s+/g,' ').trim()).join('\n')+'\n'}return text;
}
function parseDemandFromConsumption(text){const line=firstMatch(text,/ConsumoTotal\s+([^\n]+)/i);if(!line)return null;const values=(line.match(/[\d,.]+/g)||[]).map(receiptNumber).filter(Number.isFinite);return values.length>=4?Math.max(values[2],values[3]):null}
function parseBilledLine(text,label){const pattern=new RegExp(label+'[^\\n]*?([\\d,.]+)\\s+kW\\.?h\\s+([\\d,.]+)','i'),match=text.match(pattern);return match?{energy:receiptNumber(match[1]),rate:receiptNumber(match[2])}:null}
function parseReceipt(text,fileName){
 const tariff=(firstMatch(text,/(?:Opcion\s+Tarifaria|TARIFA)\s+(MT3|MT4|BT3|BT5B)/i)||'').toUpperCase();if(!tariff)throw new Error('No se pudo identificar la tarifa MT3, MT4, BT3 o BT5B.');
 const site=fileName.replace(/\.[^.]+$/,'').replace(/^\d+_[A-Z]{2}_/i,'').replace(/_/g,' '),periodText=firstMatch(text,/MES\s+FACTURADO\s*:?[\s]*([A-Za-zÁÉÍÓÚáéíóú]+-20\d{2}|20\d{4})/i),period=receiptPeriod(periodText);
 const total=receiptNumber(firstMatch(text,/(?:TOTAL\s+A\s+PAGAR\s+S\/\s*:|TOTAL\s+MES|TOTAL\s+S\/\.?)\s*\**\s*([\d,.]+)/i)),fixed=receiptNumber(firstMatch(text,/CARGO\s+FIJO\s+([\d,.]+)/i));
 if(tariff==='BT5B')return {tariff,site,period,total,fixed,energy:receiptNumber(firstMatch(text,/CONSUMO\s+FACTURADO\s+([\d,.]+)\s*kWh/i)),rate:receiptNumber(firstMatch(text,/COSTO\s+DE\s+kW\.h\s+ES:\s*S\/\s*([\d,.]+)/i))};
 if(tariff==='MT4'){
  const energyTotal=receiptNumber(firstMatch(text,/ENERGIA\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+([\d,.]+)\s+[\d,.]+\s+kW\.h/i)),energyRate=receiptNumber(firstMatch(text,/ENERGIA[^\n]*kW\.h\s+([\d,.]+)/i));
  const dist=text.match(/POTENCIA\s+POR\s+DISTRIBUIDORA[^\n]*?([\d,.]+)\s+([\d,.]+)\s+KW\s+([\d,.]+)/i),gen=text.match(/POTENCIA\s+POR\s+GENERADORA[^\n]*?([\d,.]+)\s+([\d,.]+)\s+KW\s+([\d,.]+)/i);
  const energyHP=receiptNumber(firstMatch(text,/Energia\s+Hora\s+Punta\s+([\d,.]+)\s*KWH/i)),hours=receiptNumber(firstMatch(text,/(?:Horas\s+Hora\s+Punta\s+del\s+mes|N\S*\s*Horas\s+Punta)\s+([\d,.]+)/i)),demand=receiptNumber(firstMatch(text,/Maxima\s+Demanda\s+del\s+Mes\s+([\d,.]+)\s*KW/i)),statedFactor=receiptNumber(firstMatch(text,/(?:Grado\s+de\s+Utilizaci\S*|Calificacion)\s+([\d,.]+)/i));
  return {tariff,site,period,total,fixed,energyTotal,energyRate,energyHP,hours,demand,statedFactor,distDemand:dist?receiptNumber(dist[2]):null,distRate:dist?receiptNumber(dist[3]):null,genDemand:gen?receiptNumber(gen[2]):null,genRate:gen?receiptNumber(gen[3]):null};
 }
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
 }else if(data.tariff==='MT4'){
  if(data.site)$('mt4Site').value=data.site;if(data.period)$('mt4Period').value=data.period;if(data.energyTotal!=null)$('mt4EnergyTotal').value=data.energyTotal;if(data.energyHP!=null)$('mt4EnergyHP').value=data.energyHP;if(data.demand!=null)$('mt4Demand').value=data.demand;if(data.hours!=null){$('mt4HoursElapsed').value=data.hours;$('mt4HoursMonth').value=data.hours;$('mt4DaysRemaining').value=0}if(data.energyRate!=null)$('mt4EnergyRate').value=data.energyRate;if(data.distDemand!=null)$('mt4DistDemand').value=data.distDemand;if(data.distRate!=null)$('mt4DistRate').value=data.distRate;if(data.genDemand!=null)$('mt4GenDemand').value=data.genDemand;if(data.genRate!=null)$('mt4GenRate').value=data.genRate;localStorage.setItem('mt4-settings',JSON.stringify(values(mt4Ids)));renderMT4();
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
function curvePeriod(){const value=$('curvePeriodicity').value;return value==='weekly'?{key:value,label:'semanal',multiplier:4.33}:value==='biweekly'?{key:value,label:'quincenal',multiplier:2}:{key:'monthly',label:'mensual',multiplier:1}}
function summarizeCurve(points){
 if(!points.length)return null;const inferred=inferInterval(points),interval=inferred||Math.max(1,num('curveInterval')),hours=interval/60,start=num('peakStart'),end=num('peakEnd'),period=curvePeriod();
 const peakPoints=points.filter(p=>{const h=p.date.getHours()+p.date.getMinutes()/60;return start<end?h>=start&&h<end:h>=start||h<end});
 const sourceTotal=points.reduce((sum,p)=>sum+p.value,0),sourcePeakEnergy=peakPoints.reduce((sum,p)=>sum+p.value,0),sourcePeakHours=peakPoints.length*hours,total=sourceTotal*period.multiplier,peakEnergy=sourcePeakEnergy*period.multiplier,peakHours=sourcePeakHours*period.multiplier,demand=Math.max(...points.map(p=>p.value/hours)),fc=factor(peakEnergy,peakHours,demand),target=num('curveTarget')||activeTarget(selectedTariff());
 return {interval,total,peakEnergy,peakHours,demand,fc,target,status:stateFor(fc,target),points:points.length,sourceTotal,sourcePeakEnergy,sourcePeakHours,period};
}
function panelScenarioCurve(){
 if(curveSets.after.length)return {points:curveSets.after,source:'Curva AC después cargada'};
 if(!curveSets.before.length||!curveSets.pv.length)return null;
 const pvByTime=new Map(curveSets.pv.map(p=>[p.date.getTime(),p.value])),matched=curveSets.before.filter(p=>pvByTime.has(p.date.getTime())).length;
 if(matched>=Math.min(curveSets.before.length,curveSets.pv.length)*.8)return {points:curveSets.before.map(p=>({date:new Date(p.date),value:Math.max(0,p.value-(pvByTime.get(p.date.getTime())||0))})),source:'Estimación AC antes − FV por fecha'};
 if(curveSets.before.length===curveSets.pv.length)return {points:curveSets.before.map((p,i)=>({date:new Date(p.date),value:Math.max(0,p.value-curveSets.pv[i].value)})),source:'Estimación AC antes − FV por intervalo'};
 return null;
}
function batteryBaseScenario(){return panelScenarioCurve()|| (curveSets.before.length?{points:curveSets.before,source:'Curva AC antes (sin escenario FV completo)'}:null)}
const scenarioRateIds=['scenarioFixedRate','scenarioEnergyRate','scenarioGenPeakRate','scenarioGenOffPeakRate','scenarioDistPeakRate','scenarioDistOffPeakRate'];
function scenarioRates(){return values(scenarioRateIds)}
function mt4ScenarioCost(summary){
 const d=values(mt4Ids),rates=scenarioRates(),present=summary.fc>=.5,energy=summary.total*rates.scenarioEnergyRate,generation=d.mt4GenDemand*(present?rates.scenarioGenPeakRate:rates.scenarioGenOffPeakRate),distribution=d.mt4DistDemand*(present?rates.scenarioDistPeakRate:rates.scenarioDistOffPeakRate),fixed=rates.scenarioFixedRate,additional=d.mt4Other,subtotal=energy+generation+distribution+fixed+additional,igv=subtotal*d.mt4Tax,nonTaxed=d.mt4NonTaxed,total=subtotal+igv+nonTaxed;
 return {present,classification:present?'Presente en punta':'Fuera de punta',energy,generation,distribution,fixed,additional,subtotal,igv,nonTaxed,total};
}
function renderBatteryComparison(){
 const base=summarizeCurve(curveSets.before),panelScenario=panelScenarioCurve(),panels=panelScenario?summarizeCurve(panelScenario.points):null,battery=batterySimulationActive?summarizeCurve(batteryCurve):null,rows=[['Antes de paneles',base,'Curva AC antes'],['Luego del uso de paneles',panels,panelScenario?.source||'Requiere AC después o AC antes + FV'],['Paneles + baterías de litio',battery,battery?'Simulación ESM-48150B1':'Ejecute la simulación']];
 if(!base&&!panels&&!battery){$('batteryComparisonRows').innerHTML='<tr><td colspan="11" class="empty">Cargue las curvas para comparar los escenarios.</td></tr>';$('mt4ChargeRows').innerHTML='<tr><td colspan="4" class="empty">Cargue las curvas para calcular los cobros.</td></tr>';return}
 const baseCost=base?mt4ScenarioCost(base).total:0;
 $('batteryComparisonRows').innerHTML=rows.map(([name,r,source])=>{if(!r)return `<tr><td>${name}</td><td class="scenario-source">${source}</td><td colspan="9">—</td></tr>`;const delta=base?r.fc-base.fc:0,reduction=base?Math.max(0,base.total-r.total):0,reductionPct=base?.total?reduction/base.total*100:0,charge=mt4ScenarioCost(r),saving=Math.max(0,baseCost-charge.total),status=stateFor(r.fc,r.target);return `<tr><td><b>${name}</b></td><td class="scenario-source">${source}</td><td>${nf(r.total)} kWh</td><td><b>${nf(reduction)} kWh</b><br><span class="scenario-source">${nf(reductionPct)} %</span></td><td><b>${money(charge.total)}</b><br><span class="scenario-source">${charge.classification}</span></td><td><b>${money(saving)}</b></td><td>${nf(r.peakEnergy)} kWh</td><td>${nf(r.demand)} kW</td><td><b>${nf(r.fc)}</b></td><td class="factor-delta">${base?(delta>0?'+':'')+nf(delta):'—'}</td><td><span class="tag ${status.cls}">${status.label}</span></td></tr>`}).join('');
 const scenarioSummaries=[base,panels,battery],charges=scenarioSummaries.map(r=>r?mt4ScenarioCost(r):null),chargeRow=(label,key,cls='')=>`<tr class="${cls}"><td>${label}</td>${charges.map(c=>`<td>${c?money(c[key]):'—'}</td>`).join('')}</tr>`;
 $('mt4ChargeRows').innerHTML=chargeRow('Cobro por energía activa','energy')+chargeRow('Potencia de generación','generation')+chargeRow('Potencia de distribución','distribution')+chargeRow('Cargo fijo','fixed')+chargeRow('Cargos adicionales','additional')+chargeRow('Subtotal sin IGV','subtotal')+chargeRow('IGV','igv')+chargeRow('Conceptos posteriores al IGV','nonTaxed')+chargeRow('TOTAL ESTIMADO','total','charge-total')+`<tr><td>Ahorro frente al escenario inicial</td>${charges.map(c=>`<td>${c?money(Math.max(0,baseCost-c.total)):'—'}</td>`).join('')}</tr>`;
 $('batteryComparisonNote').textContent=panelScenario?`Los cobros MT4 cambian automáticamente de “presente en punta” a “fuera de punta” cuando el factor baja de 0,50. Consumos y cobros están mensualizados; energía reactiva no incluida. Cada reducción y ahorro se compara con la curva AC antes. El escenario con paneles usa: ${panelScenario.source}.`:'Para calcular el escenario con paneles, cargue la curva AC después o curvas AC antes y FV con igual cantidad de intervalos.';
}
const batteryIds=['batteryCapacity','batteryDoD','batteryDischargeEfficiency','batteryInstalled'];
const solarSizingIds=['solarPanelWp','solarPeakSunHours','solarSystemEfficiency','batteryChargeEfficiency'];
let batteryPlan=null;
let batterySimulationActive=false;
let batteryCurve=[];
function batteryValues(){return Object.fromEntries(batteryIds.map(id=>[id,num(id)]))}
function solarSizingValues(){return Object.fromEntries(solarSizingIds.map(id=>[id,num(id)]))}
function peakWindowHours(){const start=num('peakStart'),end=num('peakEnd');return Math.max(.01,start<end?end-start:24-start+end)}
function drawBatteryResultChart(){
 const svg=$('batteryCurveChart'),scenario=batteryBaseScenario(),before=scenario?.points||[],after=batteryCurve,W=1000,H=330,p=48;if(!batterySimulationActive||!before.length||!after.length){svg.innerHTML='<text x="500" y="165" text-anchor="middle" fill="#65736f">Ejecute la simulación para visualizar la curva después de las baterías</text>';$('batteryChartBefore').textContent='—';$('batteryChartAfter').textContent='—';$('batteryChartReduction').textContent='—';$('batteryChartNote').textContent='La simulación usará el suministro con paneles y mantendrá separada la curva AC después cargada.';return}
 const all=[...before,...after],start=Math.min(...all.map(v=>v.date.getTime())),end=Math.max(...all.map(v=>v.date.getTime())),max=Math.max(...all.map(v=>v.value),.01),x=d=>p+(d.getTime()-start)*(W-2*p)/Math.max(1,end-start),y=v=>H-p-v/max*(H-2*p),step=Math.max(1,Math.ceil(before.length/500)),indices=before.map((_,i)=>i).filter(i=>i%step===0||i===before.length-1),beforePath=indices.map((i,n)=>`${n?'L':'M'} ${x(before[i].date).toFixed(1)} ${y(before[i].value).toFixed(1)}`).join(' '),afterPath=indices.map((i,n)=>`${n?'L':'M'} ${x(after[i].date).toFixed(1)} ${y(after[i].value).toFixed(1)}`).join(' '),area=`${beforePath} ${indices.slice().reverse().map(i=>`L ${x(after[i].date).toFixed(1)} ${y(after[i].value).toFixed(1)}`).join(' ')} Z`,bSummary=summarizeCurve(before),aSummary=summarizeCurve(after),reduction=Math.max(0,bSummary.total-aSummary.total);
 svg.innerHTML=`<line x1="${p}" y1="${H-p}" x2="${W-p}" y2="${H-p}" stroke="#cfdad5"/><line x1="${p}" y1="${p}" x2="${p}" y2="${H-p}" stroke="#cfdad5"/><path d="${area}" fill="rgba(245,158,11,.20)"/><path d="${beforePath}" fill="none" stroke="#0f766e" stroke-width="3"/><path d="${afterPath}" fill="none" stroke="#2563eb" stroke-width="3"/><line x1="${p}" y1="20" x2="${p+30}" y2="20" stroke="#0f766e" stroke-width="4"/><text x="${p+38}" y="24" fill="#40514c" font-size="12">AC antes</text><line x1="${p+155}" y1="20" x2="${p+185}" y2="20" stroke="#2563eb" stroke-width="4"/><text x="${p+193}" y="24" fill="#40514c" font-size="12">Después de baterías</text><rect x="${p+365}" y="14" width="28" height="12" fill="rgba(245,158,11,.28)"/><text x="${p+401}" y="24" fill="#40514c" font-size="12">Energía reducida</text><text x="4" y="${p+4}" fill="#65736f" font-size="12">${nf(max)} kWh</text><text x="${p}" y="${H-10}" fill="#65736f" font-size="12">${new Date(start).toLocaleString('es-PE')}</text><text x="${W-p}" y="${H-10}" text-anchor="end" fill="#65736f" font-size="12">${new Date(end).toLocaleString('es-PE')}</text>`;$('batteryChartBefore').textContent=`${nf(bSummary.total)} kWh`;$('batteryChartAfter').textContent=`${nf(aSummary.total)} kWh`;$('batteryChartReduction').textContent=`${nf(reduction)} kWh`;$('batteryChartNote').textContent=`El área amarilla representa la energía retirada por las baterías entre ${nf(num('peakStart'),0)}:00 y ${nf(num('peakEnd'),0)}:00.`;
}
function renderBatteryPlanner(){
 const scenario=batteryBaseScenario(),base=summarizeCurve(scenario?.points||[]),b=batteryValues(),usable=b.batteryCapacity*b.batteryDoD*b.batteryDischargeEfficiency;$('batteryUsable').textContent=`${nf(usable)} kWh`;$('batteryInstalledLabel').textContent=`Con ${nf(b.batteryInstalled,0)} batería(s) instalada(s)`;
 if(!base){batteryPlan=null;['batteryOptimalCapacity','batteryMonthlyRequired','batteryDailyRequired','batteryRecommended','batteryDailyAvailable','batteryDailyHours','batteryAveragePower','batterySimulatedFactor','solarRechargeEnergy','solarPanelDailyYield','solarPanelsRecommended','solarInstalledPower'].forEach(id=>$(id).textContent='—');$('batteryPeakDays').textContent='Según días punta de la muestra';$('batterySchedule').textContent='Horario de descarga';$('batterySimulationStatus').textContent='Esperando curva AC';$('batteryAction').className='battery-action';$('batteryAction').textContent='Cargue la curva AC antes o después para dimensionar las baterías.';$('solarAction').className='battery-action';$('solarAction').textContent='Esperando el cálculo de energía que debe retirarse de horas punta.';$('simulateBatteryBtn').disabled=true;drawBatteryResultChart();renderBatteryComparison();return}
 const days=Math.max(1,base.peakHours/peakWindowHours()),required=Math.max(0,base.peakEnergy-base.target*base.peakHours*base.demand),operationHours=required>0?peakWindowHours():0,daily=required/days,optimalCapacity=b.batteryDoD*b.batteryDischargeEfficiency>0?daily/(b.batteryDoD*b.batteryDischargeEfficiency):0,recommended=b.batteryCapacity>0?Math.ceil(optimalCapacity/b.batteryCapacity):0,dailyAvailable=b.batteryInstalled*usable,monthlyAvailable=dailyAvailable*days,reduction=Math.min(required,monthlyAvailable),simulated=factor(Math.max(0,base.peakEnergy-reduction),base.peakHours,base.demand),averagePower=operationHours?Math.min(daily,dailyAvailable)/operationHours:0,status=stateFor(simulated,base.target),solar=solarSizingValues(),rechargeEnergy=solar.batteryChargeEfficiency>0?daily/solar.batteryChargeEfficiency:0,panelDailyYield=solar.solarPanelWp/1000*solar.solarPeakSunHours*solar.solarSystemEfficiency,panelsRecommended=panelDailyYield>0?Math.ceil(rechargeEnergy/panelDailyYield):0,solarInstalledPower=panelsRecommended*solar.solarPanelWp/1000;batteryPlan={base,b,usable,days,required,daily,optimalCapacity,recommended,dailyAvailable,monthlyAvailable,reduction,simulated,status,operationHours,averagePower,source:scenario.source,rechargeEnergy,panelDailyYield,panelsRecommended,solarInstalledPower};
 $('batteryOptimalCapacity').textContent=`${nf(optimalCapacity)} kWh`;$('batteryMonthlyRequired').textContent=`${nf(required)} kWh`;$('batteryDailyRequired').textContent=`${nf(daily)} kWh`;$('batteryPeakDays').textContent=`${nf(days,1)} días punta mensualizados`;$('batteryRecommended').textContent=`${nf(recommended,0)} unidad(es)`;$('batteryDailyAvailable').textContent=`${nf(dailyAvailable)} kWh`;$('batteryDailyHours').textContent=operationHours?`${nf(operationHours,1)} h/día`:'0 h/día';$('batterySchedule').textContent=operationHours?`De ${nf(num('peakStart'),0)}:00 a ${nf(num('peakEnd'),0)}:00`:'No requiere descarga';$('batteryAveragePower').textContent=`${nf(averagePower)} kW`;$('batterySimulatedFactor').textContent=nf(simulated);$('batterySimulatedFactor').className=status.cls;$('batterySimulationStatus').textContent=`Meta: ${nf(base.target)} · reducción ${nf(reduction)} kWh`;$('solarRechargeEnergy').textContent=`${nf(rechargeEnergy)} kWh/día`;$('solarPanelDailyYield').textContent=`${nf(panelDailyYield)} kWh/día`;$('solarPanelsRecommended').textContent=`${nf(panelsRecommended,0)} panel(es)`;$('solarInstalledPower').textContent=`${nf(solarInstalledPower)} kWp`;$('simulateBatteryBtn').disabled=!scenario;
 const action=$('batteryAction');if(required===0){action.className='battery-action good';action.textContent='La curva ya cumple la meta. Mantenga las baterías como reserva y evite descargas innecesarias.'}else if(b.batteryInstalled>=recommended){action.className='battery-action good';action.textContent=`Capacidad óptima: ${nf(optimalCapacity)} kWh nominales. Las ${nf(b.batteryInstalled,0)} baterías disponibles cubren la descarga durante ${nf(operationHours,1)} horas al día.`}else{action.className='battery-action warn';action.textContent=`Capacidad óptima: ${nf(optimalCapacity)} kWh nominales. Se recomiendan ${nf(recommended,0)} baterías ESM-48150B1; faltan ${nf(Math.max(0,recommended-b.batteryInstalled),0)} unidad(es).`}const solarAction=$('solarAction');if(required===0){solarAction.className='battery-action good';solarAction.textContent='No se requiere energía adicional para recargar baterías destinadas a reducir el factor.'}else{solarAction.className='battery-action good';solarAction.textContent=`Instale al menos ${nf(panelsRecommended,0)} panel(es) de ${nf(solar.solarPanelWp,0)} Wp (${nf(solarInstalledPower)} kWp) para producir ${nf(rechargeEnergy)} kWh/día y evitar que la recarga aumente el consumo de red en hora fuera de punta.`}drawBatteryResultChart();renderBatteryComparison();
}
async function simulateBatteryCurve(){
 if(!factorApplicable())return;const scenario=batteryBaseScenario(),source=scenario?.points||[];if(!source.length||!batteryPlan)return;const summary=summarizeCurve(source),hours=peakWindowHours(),sourceDays=Math.max(1,summary.sourcePeakHours/hours),required=Math.max(0,summary.sourcePeakEnergy-summary.target*summary.sourcePeakHours*summary.demand),available=batteryPlan.dailyAvailable*sourceDays,reduction=Math.min(required,available),ratio=summary.sourcePeakEnergy>0?reduction/summary.sourcePeakEnergy:0,start=num('peakStart'),end=num('peakEnd');
 batteryCurve=source.map(point=>{const h=point.date.getHours()+point.date.getMinutes()/60,peak=start<end?h>=start&&h<end:h>=start||h<end;return {date:new Date(point.date),value:peak?Math.max(0,point.value*(1-ratio)):point.value}});batterySimulationActive=true;const tariff=selectedTariff(),record=await dbAction('curves','readonly',store=>store.get(tariff))||{tariff,curves:{}};record.curves=record.curves||{};record.batterySimulation={name:`Simulación ${$('batteryModel').value}`,source:scenario.source,points:batteryCurve.map(p=>({date:p.date.toISOString(),value:p.value})),updatedAt:new Date().toISOString()};record.target=num('curveTarget');await dbAction('curves','readwrite',store=>store.put(record));$('uploadMessage').textContent=`Curva de baterías simulada por separado con ${nf(batteryPlan.b.batteryInstalled,0)} batería(s): nuevo factor ${nf(summarizeCurve(batteryCurve).fc)}, operación ${nf(batteryPlan.operationHours,1)} h/día. La curva AC después del suministro no fue modificada.`;renderCurve();
}
function drawACChart(){
 const svg=$('acCurveChart'),W=1000,H=330,p=48,available=Object.values(curveSets).filter(points=>points.length);if(!available.length){svg.innerHTML='<text x="500" y="160" text-anchor="middle" fill="#65736f">Cargue una o más curvas Excel o CSV para compararlas</text>';return}
 const all=available.flat(),start=Math.min(...all.map(v=>v.date.getTime())),end=Math.max(...all.map(v=>v.date.getTime())),max=Math.max(...all.map(v=>v.value),.01),x=d=>p+(d.getTime()-start)*(W-2*p)/Math.max(1,end-start),y=v=>H-p-v/max*(H-2*p);
 const series=[['before','AC antes','#0f766e'],['after','AC después','#2563eb'],['pv','Fotovoltaica','#dc2626']];let paths='';
 for(const [key,label,color] of series){const source=curveSets[key],step=Math.max(1,Math.ceil(source.length/500)),data=source.filter((_,i)=>i%step===0||i===source.length-1);if(!data.length)continue;const path=data.map((v,i)=>`${i?'L':'M'} ${x(v.date).toFixed(1)} ${y(v.value).toFixed(1)}`).join(' ');paths+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="3"/><line x1="${p+series.findIndex(s=>s[0]===key)*170}" y1="20" x2="${p+30+series.findIndex(s=>s[0]===key)*170}" y2="20" stroke="${color}" stroke-width="4"/><text x="${p+38+series.findIndex(s=>s[0]===key)*170}" y="24" fill="#40514c" font-size="12">${label}</text>`}
 svg.innerHTML=`<line x1="${p}" y1="${H-p}" x2="${W-p}" y2="${H-p}" stroke="#cfdad5"/><line x1="${p}" y1="${p}" x2="${p}" y2="${H-p}" stroke="#cfdad5"/>${paths}<text x="4" y="${p+4}" fill="#65736f" font-size="12">${nf(max)} kWh</text><text x="${p}" y="${H-10}" fill="#65736f" font-size="12">${new Date(start).toLocaleString('es-PE')}</text><text x="${W-p}" y="${H-10}" text-anchor="end" fill="#65736f" font-size="12">${new Date(end).toLocaleString('es-PE')}</text>`;
}
function renderCurve(){
 const before=summarizeCurve(curveSets.before),after=summarizeCurve(curveSets.after),pv=summarizeCurve(curveSets.pv);curveSummary=after||before;renderTariffWorkflow();drawACChart();if(factorApplicable())renderBatteryPlanner();$('applyCurveBtn').disabled=!curveSummary;
 $('curveBeforeTotal').textContent=before?`${nf(before.total)} kWh`:'—';$('curveBeforePoints').textContent=before?`${before.points} intervalos · ${before.period.label} × ${nf(before.period.multiplier,2)}`:'Sin curva cargada';$('curveTotal').textContent=after?`${nf(after.total)} kWh`:'—';$('curvePoints').textContent=after?`${after.points} intervalos · ${after.period.label} × ${nf(after.period.multiplier,2)}`:'Sin curva AC después';$('pvCurveTotal').textContent=pv?`${nf(pv.total)} kWh`:'—';$('pvCurvePoints').textContent=pv?`${pv.points} intervalos · ${pv.period.label} × ${nf(pv.period.multiplier,2)}`:'Sin curva cargada';
 if(before&&after){const reduction=before.total-after.total,pct=before.total?reduction/before.total*100:0;$('curveReduction').textContent=`${nf(reduction)} kWh`;$('curveReductionStatus').textContent=`${nf(pct)} % respecto de la línea base`}else{$('curveReduction').textContent='—';$('curveReductionStatus').textContent='Requiere ambas curvas AC'}
 if(!curveSummary){['curveTotal','curvePeakEnergy','curveDemand','curveFactor'].forEach(id=>$(id).textContent='—');$('curvePoints').textContent='Sin curva cargada';$('curveValidation').innerHTML=factorApplicable()?'<span class="status-pill">Sin datos</span><h3>Validación pendiente</h3><p>Cargue la curva AC después para evaluar el factor objetivo.</p>':'<span class="status-pill good">Ruta BT5B</span><h3>Factor no aplicable</h3><p>Cargue una curva para evaluar únicamente consumo y costo.</p>';return}
 const r=curveSummary;$('curveInterval').value=nf(r.interval,0);if(!factorApplicable()){$('curveValidation').className='curve-validation good';$('curveValidation').innerHTML='<span class="status-pill good">Ruta BT5B</span><h3>Factor de calificación no aplicable</h3><p>Se analizarán únicamente consumo mensual, reducción de energía y costo. No se dimensionan baterías para modificar el factor.</p>';return}$('curvePeakEnergy').textContent=`${nf(r.peakEnergy)} kWh`;$('curvePeakHours').textContent=`${nf(r.peakHours)} horas HP mensualizadas${after?'':' · calculado con AC antes'}`;$('curveDemand').textContent=`${nf(r.demand)} kW`;$('curveFactor').textContent=nf(r.fc);$('curveFactor').className=r.status.cls;$('curveFactorStatus').textContent=`Objetivo: ${nf(r.target)} · muestra ${r.period.label}${after?'':' · evaluación provisional con AC antes'}`;
 const ok=r.fc<=r.target+.0005,box=$('curveValidation');box.className=`curve-validation ${ok?'good':r.status.cls}`;box.innerHTML=`<span class="status-pill ${ok?'good':r.status.cls}">${ok?'Objetivo validado':'Requiere acción'}</span><h3>${ok?'La curva cumple la meta':'El factor supera la meta'}</h3><p>Muestra ${r.period.label} mensualizada con factor × ${nf(r.period.multiplier,2)}. La demanda máxima se mantiene sin multiplicar. ${ok?`Existe un margen de ${nf(Math.max(0,r.target-r.fc))}.`:`Debe retirar ${nf(Math.max(0,r.peakEnergy-r.target*r.peakHours*r.demand))} kWh mensuales de horas punta. Diferencia del factor: ${nf(r.fc-r.target)}.`}</p>`;
}
const hydrate=points=>(points||[]).map(p=>({date:new Date(p.date),value:p.value}));
async function loadCurve(){const tariff=selectedTariff(),record=await dbAction('curves','readonly',store=>store.get(tariff)),legacySimulation=Boolean(record?.curves?.after?.name?.startsWith('Simulación '));curveSets={before:hydrate(record?.curves?.before?.points||record?.points),after:legacySimulation?[]:hydrate(record?.curves?.after?.points),pv:hydrate(record?.curves?.pv?.points)};batteryCurve=hydrate(record?.batterySimulation?.points||(legacySimulation?record?.curves?.after?.points:[]));batterySimulationActive=Boolean(batteryCurve.length);if(record?.target)$('curveTarget').value=record.target;$('curvePeriodicity').value=localStorage.getItem(`curve-periodicity-${tariff}`)||record?.periodicity||'monthly';const labels={before:'curveBeforeStatus',after:'curveAfterStatus',pv:'pvCurveStatus'};Object.entries(labels).forEach(([key,id])=>$(id).textContent=key==='after'&&legacySimulation?'Sin archivo':record?.curves?.[key]?.name||((key==='before'&&record?.name)?record.name:'Sin archivo'));renderCurve()}
async function importCurve(file,kind,inputId){try{const data=await parseCurveFile(file),interval=inferInterval(data),tariff=selectedTariff(),existing=await dbAction('curves','readonly',store=>store.get(tariff))||{tariff,curves:{}};existing.curves=existing.curves||{};existing.curves[kind]={name:file.name,points:data.map(p=>({date:p.date.toISOString(),value:p.value})),updatedAt:new Date().toISOString()};delete existing.batterySimulation;batteryCurve=[];batterySimulationActive=false;existing.target=num('curveTarget');await dbAction('curves','readwrite',store=>store.put(existing));curveSets[kind]=data;$('curveInterval').value=nf(interval,0);const label=kind==='before'?'AC antes':kind==='after'?'AC después':'fotovoltaica';$('uploadMessage').textContent=`Curva ${label} cargada: ${data.length} intervalos de ${nf(interval,0)} minutos. Vuelva a ejecutar la simulación de baterías para actualizar el escenario combinado.`;$(kind==='before'?'curveBeforeStatus':kind==='after'?'curveAfterStatus':'pvCurveStatus').textContent=file.name;renderCurve()}catch(error){$('uploadMessage').textContent=error.message}finally{$(inputId).value=''}}
function applyCurve(){if(!curveSummary)return;const r=curveSummary,tariff=selectedTariff();if(tariff==='MT3'){$('energyHP').value=r.peakEnergy;$('maxDemand').value=r.demand;$('hoursElapsed').value=r.peakHours;$('targetFactor').value=r.target;render()}else if(tariff==='MT4'){$('mt4EnergyTotal').value=r.total;$('mt4EnergyHP').value=r.peakEnergy;$('mt4Demand').value=r.demand;$('mt4HoursElapsed').value=r.peakHours;$('mt4Target').value=r.target;renderMT4()}else if(tariff==='BT3'){$('bt3EnergyHP').value=r.peakEnergy;$('bt3Demand').value=r.demand;$('bt3HoursElapsed').value=r.peakHours;$('bt3Target').value=r.target;renderBT3()}else{$('bt5Energy').value=r.total;renderBT5()}$('uploadMessage').textContent=`Lectura de curva aplicada al módulo ${tariff}.`}

$('receiptFiles').addEventListener('change',event=>saveReceipts(event.target.files));$('curveBeforeFile').addEventListener('change',event=>event.target.files[0]&&importCurve(event.target.files[0],'before','curveBeforeFile'));$('curveAfterFile').addEventListener('change',event=>event.target.files[0]&&importCurve(event.target.files[0],'after','curveAfterFile'));$('pvCurveFile').addEventListener('change',event=>event.target.files[0]&&importCurve(event.target.files[0],'pv','pvCurveFile'));
$('receiptList').addEventListener('click',event=>{const open=event.target.closest('[data-open-receipt]'),del=event.target.closest('[data-delete-receipt]');if(open){event.preventDefault();openReceipt(open.dataset.openReceipt)}if(del)deleteReceipt(del.dataset.deleteReceipt)});
$('dataTariff').addEventListener('change',async()=>{syncCurveTarget();await Promise.all([renderReceipts(),loadCurve()])});['curveInterval','peakStart','peakEnd','curveTarget'].forEach(id=>$(id).addEventListener('input',renderCurve));$('curvePeriodicity').addEventListener('change',()=>{localStorage.setItem(`curve-periodicity-${selectedTariff()}`,$('curvePeriodicity').value);renderCurve()});$('applyCurveBtn').addEventListener('click',applyCurve);
batteryIds.forEach(id=>$(id).addEventListener('input',()=>{localStorage.setItem('battery-esm48150b1',JSON.stringify(batteryValues()));renderBatteryPlanner()}));$('simulateBatteryBtn').addEventListener('click',simulateBatteryCurve);const savedBattery=JSON.parse(localStorage.getItem('battery-esm48150b1')||'null');if(savedBattery)batteryIds.forEach(id=>{if(savedBattery[id]!==undefined)$(id).value=savedBattery[id]});
const savedSolarSizing=JSON.parse(localStorage.getItem('solar-recharge-sizing')||'null');if(savedSolarSizing)solarSizingIds.forEach(id=>{if(savedSolarSizing[id]!==undefined)$(id).value=savedSolarSizing[id]});solarSizingIds.forEach(id=>$(id).addEventListener('input',()=>{localStorage.setItem('solar-recharge-sizing',JSON.stringify(solarSizingValues()));if(factorApplicable())renderBatteryPlanner()}));
const savedScenarioRates=JSON.parse(localStorage.getItem('mt4-scenario-rates')||'null');if(savedScenarioRates)scenarioRateIds.forEach(id=>{if(savedScenarioRates[id]!==undefined)$(id).value=savedScenarioRates[id]});scenarioRateIds.forEach(id=>$(id).addEventListener('input',()=>{localStorage.setItem('mt4-scenario-rates',JSON.stringify(scenarioRates()));renderBatteryComparison()}));
document.querySelectorAll('.tariff-tab').forEach(button=>button.addEventListener('click',()=>{const tariff=button.textContent.trim();$('dataTariff').value=tariff;syncCurveTarget();renderReceipts();loadCurve()}));
const currentTariff=document.querySelector('.tariff-tab.active')?.textContent.trim();if(currentTariff)$('dataTariff').value=currentTariff;syncCurveTarget();renderReceipts();loadCurve();
