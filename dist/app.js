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
