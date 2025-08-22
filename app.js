// ======== Persistence ========
const STORAGE_KEY = "contrats_security_app_v1";

let state = {
  contrats: [],            // {id, number, client, sites, type, monthly_fee, start_date, end_date, notice_days}
  clauses: [],             // {id, contract_id, category, code, title, variant, status, priority}
  slas: [],                // {id, contract_id, kpi, unit, target, result, window}
  penalites: []            // {id, contract_id, name, trigger, type, params:{...}, cap:{amount, percent}}
};

function saveLocal(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadLocal(){
  const s = localStorage.getItem(STORAGE_KEY);
  if(s){ state = JSON.parse(s); }
}
function resetApp(){
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}
function uid(){ return Math.random().toString(36).slice(2,10); }
function today(){ return new Date().toISOString().slice(0,10); }
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a)) / (1000*60*60*24)); }
function fmt(n){ return (n??0).toLocaleString('fr-FR'); }

// ======== Sample data (if empty) ========
function seedIfEmpty(){
  if(state.contrats.length) return;
  const c1 = {id: uid(), number:"C-001", client:"Hôtel Barceló", sites:"Casablanca - Anfa", type:"SSIAP", monthly_fee:120000, start_date:"2024-02-01", end_date:"2025-01-31", notice_days:90};
  const c2 = {id: uid(), number:"C-002", client:"Auchan", sites:"Rabat - Centre", type:"Filtrage", monthly_fee:85000, start_date:"2023-10-01", end_date:"2026-09-30", notice_days:120};
  state.contrats.push(c1,c2);

  state.clauses.push(
    {id: uid(), contract_id:c1.id, category:"Obligations", code:"OBL-MOY", title:"Obligation de moyens", variant:"Standard", status:"Validé", priority:1},
    {id: uid(), contract_id:c1.id, category:"Obligations", code:"OBL-RES", title:"Obligation de résultat", variant:"Remplacement < 2h", status:"Validé", priority:1},
    {id: uid(), contract_id:c2.id, category:"Prix", code:"PRX-REV", title:"Révision / Indexation", variant:"Indexation INSEE", status:"Validé", priority:1},
  );

  state.slas.push(
    {id: uid(), contract_id:c1.id, kpi:"Taux de présence", unit:"%", target:99.5, result:99.2, window:"M-1"},
    {id: uid(), contract_id:c1.id, kpi:"Délai de remplacement", unit:"min", target:120, result:140, window:"M-1"},
    {id: uid(), contract_id:c2.id, kpi:"Incidents clos < 24h", unit:"%", target:95, result:92, window:"M-1"},
  );

  // Penalty rules examples
  state.penalites.push(
    { id: uid(), contract_id:c1.id, name:"Présence < 99.5%", trigger:{type:"kpi_below_target", kpi:"Taux de présence"}, type:"percent_of_fee", params:{percent:0.5}, cap:{percent:10} },
    { id: uid(), contract_id:c1.id, name:"Remplacement > 120 min", trigger:{type:"kpi_above_target", kpi:"Délai de remplacement"}, type:"per_unit", params:{unit:"min", over_per:30, amount_per_unit:500}, cap:{amount:30000} },
    { id: uid(), contract_id:c2.id, name:"Incidents clos < 24h < 95%", trigger:{type:"kpi_below_target", kpi:"Incidents clos < 24h"}, type:"graduated", params:{tiers:[{below:90, mode:"percent_of_fee", value:0.6},{below:95, mode:"percent_of_fee", value:0.3}]}, cap:{percent:10} },
    { id: uid(), contract_id:c2.id, name:"Manquement grave", trigger:{type:"manual"}, type:"fixed", params:{amount:5000}, cap:{} }
  );

  saveLocal();
}

// ======== UI helpers ========
function switchTab(tabId){
  document.querySelectorAll(".tab").forEach(s=>s.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add("active");
}

function renderAll(){
  renderContrats();
  renderClauses();
  renderSLA();
  renderPenalites();
  renderKPI();
  drawPenaltiesChart();
}

// ======== Contrats ========
function daysRemaining(end){
  const d = daysBetween(new Date().toISOString().slice(0,10), end);
  return d<0 ? 0 : d;
}
function isAlert90(end, noticeDays=90){
  const d = daysRemaining(end);
  return d<=90 && d>=0;
}
function renderContrats(){
  const tb = document.querySelector("#table-contrats tbody");
  tb.innerHTML="";
  const q = (document.getElementById("search-contrat").value||"").toLowerCase();
  const alertOnly = document.getElementById("filter-alert").checked;
  state.contrats.forEach(c=>{
    const match = !q || [c.number,c.client,c.sites].some(x=>String(x).toLowerCase().includes(q));
    const alert = isAlert90(c.end_date, c.notice_days);
    if(match && (!alertOnly || alert)){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.number}</td>
        <td>${c.client}</td>
        <td>${c.sites}</td>
        <td>${c.type||""}</td>
        <td>${fmt(c.monthly_fee)}</td>
        <td>${c.start_date}</td>
        <td>${c.end_date}</td>
        <td>${c.notice_days||""}</td>
        <td>${alert?'<span class="badge-alert">ALERTE</span>':'-'}</td>
        <td>${daysRemaining(c.end_date)}</td>
        <td class="actions">
          <button onclick="editContrat('${c.id}')">✎</button>
          <button onclick="delContrat('${c.id}')">🗑️</button>
        </td>`;
      tb.appendChild(tr);
    }
  });
  // filters options for other tabs
  const selects = ["filter-clause-contrat","filter-sla-contrat","filter-penalite-contrat"];
  selects.forEach(id=>{
    const s = document.getElementById(id);
    if(!s) return;
    const prev = s.value;
    s.innerHTML = `<option value="">Tous les contrats</option>` + state.contrats.map(c=>`<option value="${c.id}">${c.number} – ${c.client}</option>`).join("");
    if(prev) s.value = prev;
  });
}

function addContratModal(){
  openModal("Créer contrat", `
    <div class="row">
      <label>N°<input id="f-number"></label>
      <label>Client<input id="f-client"></label>
      <label>Sites<input id="f-sites"></label>
      <label>Type<input id="f-type"></label>
      <label>Tarif mensuel (MAD)<input type="number" id="f-fee"></label>
      <label>Début<input type="date" id="f-start" value="${today()}"></label>
      <label>Fin<input type="date" id="f-end"></label>
      <label>Préavis (j)<input type="number" id="f-notice" value="90"></label>
    </div>
  `, ()=>{
    const c = {
      id: uid(),
      number: byId("f-number").value.trim(),
      client: byId("f-client").value.trim(),
      sites: byId("f-sites").value.trim(),
      type: byId("f-type").value.trim(),
      monthly_fee: parseFloat(byId("f-fee").value||0),
      start_date: byId("f-start").value,
      end_date: byId("f-end").value,
      notice_days: parseInt(byId("f-notice").value||90)
    };
    state.contrats.push(c); saveLocal(); renderAll();
  });
}
function editContrat(id){
  const c = state.contrats.find(x=>x.id===id);
  if(!c) return;
  openModal("Modifier contrat", `
    <div class="row">
      <label>N°<input id="f-number" value="${c.number}"></label>
      <label>Client<input id="f-client" value="${c.client}"></label>
      <label>Sites<input id="f-sites" value="${c.sites}"></label>
      <label>Type<input id="f-type" value="${c.type||''}"></label>
      <label>Tarif mensuel (MAD)<input type="number" id="f-fee" value="${c.monthly_fee}"></label>
      <label>Début<input type="date" id="f-start" value="${c.start_date}"></label>
      <label>Fin<input type="date" id="f-end" value="${c.end_date}"></label>
      <label>Préavis (j)<input type="number" id="f-notice" value="${c.notice_days||90}"></label>
    </div>
  `, ()=>{
    c.number = byId("f-number").value.trim();
    c.client = byId("f-client").value.trim();
    c.sites = byId("f-sites").value.trim();
    c.type = byId("f-type").value.trim();
    c.monthly_fee = parseFloat(byId("f-fee").value||0);
    c.start_date = byId("f-start").value;
    c.end_date = byId("f-end").value;
    c.notice_days = parseInt(byId("f-notice").value||90);
    saveLocal(); renderAll();
  });
}
function delContrat(id){
  if(!confirm("Supprimer ce contrat ?")) return;
  state.contrats = state.contrats.filter(x=>x.id!==id);
  state.clauses = state.clauses.filter(x=>x.contract_id!==id);
  state.slas = state.slas.filter(x=>x.contract_id!==id);
  state.penalites = state.penalites.filter(x=>x.contract_id!==id);
  saveLocal(); renderAll();
}


// ======== Clause Catalog (exhaustif, extraits) ========
const clauseCatalog = [
  {category:"Obligations", code:"OBL-MOY", title:"Obligation de moyens", variants:["Standard","Renforcée (astreinte)","Événementiel"]},
  {category:"Obligations", code:"OBL-RES", title:"Obligation de résultat", variants:["Présence 100% poste","Remplacement < 2h","Rapport < 24h"]},
  {category:"Obligations", code:"OBL-MIX", title:"Obligation mixte", variants:["Mixte surveillance + continuité","Mixte SLA critiques"]},
  {category:"Obligations", code:"OBL-REM", title:"Remplacement / continuité", variants:["<2h","<4h","Astreinte 24/7"]},
  {category:"Obligations", code:"OBL-REP", title:"Reporting", variants:["Journalier","Hebdomadaire","Incidents < 24h"]},
  {category:"Durée", code:"DUR-INI", title:"Durée initiale", variants:["12 mois","24 mois","36 mois","60 mois"]},
  {category:"Durée", code:"DUR-REN", title:"Renouvellement tacite", variants:["12 mois","24 mois"]},
  {category:"Résiliation", code:"RES-PRE", title:"Préavis", variants:["30 jours","60 jours","90 jours","180 jours"]},
  {category:"Résiliation", code:"RES-FAU", title:"Résiliation pour faute", variants:["Faute grave","Non-paiement"]},
  {category:"Résiliation", code:"RES-CONV", title:"Résiliation pour convenance", variants:["Avec indemnité","Sans indemnité"]},
  {category:"Résiliation", code:"RES-FM", title:"Force majeure", variants:["Incluant pandémies","Liste ouverte"]},
  {category:"Résiliation", code:"RES-IMP", title:"Imprévision", variants:["Renégociation"]},
  {category:"Prix", code:"PRX-STR", title:"Structure tarifaire", variants:["Forfait","Horaire","Mixte"]},
  {category:"Prix", code:"PRX-REV", title:"Révision / Indexation", variants:["INSEE","SMIG Maroc","CCN","Panier mixte"]},
  {category:"Prix", code:"PRX-SURC", title:"Surcoûts exceptionnels", variants:["Barème exceptionnel","Devis préalable"]},
  {category:"Facturation", code:"FAC-DEM", title:"Dématérialisation", variants:["PDF","Portail EDI"]},
  {category:"Paiement", code:"PAY-DELAI", title:"Délais de paiement", variants:["30 jours","45 jours","60 jours","Fin de mois"]},
  {category:"Paiement", code:"PAY-PEN", title:"Pénalités de retard", variants:["Taux BCE + X%","Indemnité fixe recouvrement"]},
  {category:"Paiement", code:"PAY-GAR", title:"Garanties financières", variants:["Caution","Garantie à première demande"]},
  {category:"Paiement", code:"PAY-RET", title:"Retenue de garantie", variants:["0%","5%","10%"]},
  {category:"Exploitation", code:"EXP-OBJ", title:"Objet détaillé", variants:["SSIAP","Sûreté","Filtrage","Rondes"]},
  {category:"Exploitation", code:"EXP-SLA", title:"SLA & performance", variants:["Taux présence","Remplacement","Incidents < 24h"]},
  {category:"Exploitation", code:"EXP-PLN", title:"Plan de prévention", variants:["Sites sensibles","PPSPS"]},
  {category:"Exploitation", code:"EXP-HOR", title:"Horaires & vacations", variants:["24/7","Postes fixes"]},
  {category:"Exploitation", code:"EXP-RON", title:"Rondes & contrôles", variants:["Fréquence définie"]},
  {category:"Exploitation", code:"EXP-INC", title:"Incidents & rapports", variants:["Signalement 2h","RCA 24h"]},
  {category:"Exploitation", code:"EXP-AUD", title:"Audits & contrôles", variants:["Trimestriel","Annuel"]},
  {category:"Exploitation", code:"EXP-MAIN", title:"Main courante", variants:["Électronique","Conservation 12 mois"]},
  {category:"Exploitation", code:"EXP-BDG", title:"Badges & accès", variants:["Procédure stricte"]},
  {category:"Exploitation", code:"EXP-CAM", title:"Vidéosurveillance", variants:["Charte VSS","Traçabilité"]},
  {category:"RH", code:"RH-COMP", title:"Compétences/profils", variants:["APS","SSIAP"]},
  {category:"RH", code:"RH-CARTE", title:"Carte professionnelle", variants:["CNAPS"]},
  {category:"RH", code:"RH-NONSOL", title:"Non-sollicitation", variants:["6 mois","12 mois"]},
  {category:"RH", code:"RH-L1224", title:"Transfert personnel", variants:["L1224-1 FR"]},
  {category:"Conformité", code:"CONF-CNAPS", title:"Agréments/cartes", variants:["Obligatoire"]},
  {category:"Conformité", code:"CONF-ETH", title:"Éthique/Sapin II", variants:["Politique cadeaux","Conflits intérêts"]},
  {category:"Conformité", code:"CONF-SAN", title:"Sanctions internationales", variants:["KYC","Embargos"]},
  {category:"Données", code:"IT-RGPD", title:"RGPD/CNDP", variants:["DPA joint","Conservation"]},
  {category:"Données", code:"IT-LOG", title:"Journalisation & accès", variants:["Seuils","Traçabilité"]},
  {category:"Données", code:"IT-PI", title:"Propriété intellectuelle", variants:["Livrables","Rapports"]},
  {category:"Données", code:"IT-REF", title:"Références clients", variants:["Oui","Non"]},
  {category:"Assurances", code:"ASS-RC", title:"RC Pro", variants:["5 M MAD/sinistre"]},
  {category:"Assurances", code:"ASS-ATT", title:"Attestations régulières", variants:["Annuel"]},
  {category:"Responsabilité", code:"RESP-CAP", title:"Plafonds de responsabilité", variants:["Cap","No Cap"]},
  {category:"Responsabilité", code:"RESP-EX", title:"Exclusions indirects", variants:["Perte d’exploitation","Atteinte image"]},
  {category:"Divers", code:"DIV-CES", title:"Cession de contrat", variants:["Consentement","Notification"]},
  {category:"Divers", code:"DIV-CEC", title:"Cession de créances", variants:["Dailly"]},
  {category:"Divers", code:"DIV-NOT", title:"Notifications", variants:["LRAR","Email qualifié"]},
  {category:"Divers", code:"DIV-LOI", title:"Droit & juridiction", variants:["Paris","Casablanca","Arbitrage"]},
  {category:"Divers", code:"DIV-RSE", title:"Environnement/RSE", variants:["Rapport RSE"]}
];

// ======== Clauses ========
function renderClauses(){
  const tb = document.querySelector("#table-clauses tbody"); tb.innerHTML="";
  const filter = byId("filter-clause-contrat").value;
  const q = (byId("search-clause").value||"").toLowerCase();
  state.clauses.forEach(cl=>{
    const c = state.contrats.find(x=>x.id===cl.contract_id);
    if(!c) return;
    const matchFilter = !filter || cl.contract_id===filter;
    const matchQ = !q || [cl.category,cl.code,cl.title,cl.variant].some(s=>String(s).toLowerCase().includes(q));
    if(matchFilter && matchQ){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.number}</td><td>${cl.category}</td><td>${cl.code}</td>
        <td>${cl.title}${cl.variant?(" – "+cl.variant):""}</td>
        <td>${cl.status||""}</td><td>${cl.priority||0}</td>
        <td class="actions">
          <button onclick="editClause('${cl.id}')">✎</button>
          <button onclick="delClause('${cl.id}')">🗑️</button>
        </td>`;
      tb.appendChild(tr);
    }
  });
}
function addClauseModal(){
  const options = state.contrats.map(c=>`<option value="${c.id}">${c.number} – ${c.client}</option>`).join("");
  openModal("Ajouter clause", `
    <div class="row">
      <label>Contrat<select id="cl-contract">${options}</select></label>
      <label>Depuis catalogue<select id="cl-catalog"><option value="">—</option>${clauseCatalog.map((c,i)=>`<option value="${i}">${c.category} – ${c.code} – ${c.title}</option>`).join("")}</select></label>
      <label>Catégorie<input id="cl-cat" placeholder="Obligations, Prix, Résiliation…"></label>
      <label>Code<input id="cl-code" placeholder="OBL-MOY, OBL-RES, PRX-REV…"></label>
      <label>Intitulé<input id="cl-title" placeholder="Obligation de moyens…"></label>
      <label>Variante<input id="cl-variant" placeholder="Renforcée, Remplacement < 2h…"></label>
      <label>Statut<select id="cl-status"><option>Validé</option><option>Proposé</option><option>À renégocier</option><option>Refusé</option></select></label>
      <label>Priorité<input type="number" id="cl-priority" value="0"></label>
    </div>
  `, ()=>{
    state.clauses.push({
      id: uid(),
      contract_id: byId("cl-contract").value,
      category: byId("cl-cat").value.trim(),
      code: byId("cl-code").value.trim(),
      title: byId("cl-title").value.trim(),
      variant: byId("cl-variant").value.trim(),
      status: byId("cl-status").value,
      priority: parseInt(byId("cl-priority").value||0)
    });

  const sel = document.getElementById("cl-catalog");
  if(sel){ sel.addEventListener("change", ()=>{
    const v = sel.value;
    if(v==="") return;
    const c = clauseCatalog[parseInt(v)];
    document.getElementById("cl-cat").value = c.category;
    document.getElementById("cl-code").value = c.code;
    document.getElementById("cl-title").value = c.title;
    document.getElementById("cl-variant").value = (c.variants&&c.variants.length)?c.variants[0]:"";
  }); }
    saveLocal(); renderClauses();
  });
}
function editClause(id){
  const cl = state.clauses.find(x=>x.id===id);
  if(!cl) return;
  const options = state.contrats.map(c=>`<option ${c.id===cl.contract_id?"selected":""} value="${c.id}">${c.number} – ${c.client}</option>`).join("");
  openModal("Modifier clause", `
    <div class="row">
      <label>Contrat<select id="cl-contract">${options}</select></label>
      <label>Catégorie<input id="cl-cat" value="${cl.category}"></label>
      <label>Code<input id="cl-code" value="${cl.code}"></label>
      <label>Intitulé<input id="cl-title" value="${cl.title}"></label>
      <label>Variante<input id="cl-variant" value="${cl.variant||''}"></label>
      <label>Statut<select id="cl-status">
        <option ${cl.status==='Validé'?'selected':''}>Validé</option>
        <option ${cl.status==='Proposé'?'selected':''}>Proposé</option>
        <option ${cl.status==='À renégocier'?'selected':''}>À renégocier</option>
        <option ${cl.status==='Refusé'?'selected':''}>Refusé</option></select></label>
      <label>Priorité<input type="number" id="cl-priority" value="${cl.priority||0}"></label>
    </div>
  `, ()=>{
    cl.contract_id = byId("cl-contract").value;
    cl.category = byId("cl-cat").value.trim();
    cl.code = byId("cl-code").value.trim();
    cl.title = byId("cl-title").value.trim();
    cl.variant = byId("cl-variant").value.trim();
    cl.status = byId("cl-status").value;
    cl.priority = parseInt(byId("cl-priority").value||0);

  const sel = document.getElementById("cl-catalog");
  if(sel){ sel.addEventListener("change", ()=>{
    const v = sel.value;
    if(v==="") return;
    const c = clauseCatalog[parseInt(v)];
    document.getElementById("cl-cat").value = c.category;
    document.getElementById("cl-code").value = c.code;
    document.getElementById("cl-title").value = c.title;
    document.getElementById("cl-variant").value = (c.variants&&c.variants.length)?c.variants[0]:"";
  }); }
    saveLocal(); renderClauses();
  });
}
function delClause(id){
  if(!confirm("Supprimer cette clause ?")) return;
  state.clauses = state.clauses.filter(x=>x.id!==id);
  saveLocal(); renderClauses();
}

// ======== SLA ========
function renderSLA(){
  const tb = byId("table-sla").querySelector("tbody"); tb.innerHTML="";
  const filter = byId("filter-sla-contrat").value;
  state.slas.forEach(sl=>{
    const c = state.contrats.find(x=>x.id===sl.contract_id);
    if(!c) return;
    if(filter && sl.contract_id!==filter) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.number}</td>
      <td>${sl.kpi}</td>
      <td>${sl.target} ${sl.unit}</td>
      <td>${sl.result} ${sl.unit}</td>
      <td>${sl.unit}</td>
      <td>${sl.window||""}</td>
      <td class="actions">
        <button onclick="editSLA('${sl.id}')">✎</button>
        <button onclick="delSLA('${sl.id}')">🗑️</button>
      </td>`;
    tb.appendChild(tr);
  });
}
function addSLAModal(){
  const options = state.contrats.map(c=>`<option value="${c.id}">${c.number} – ${c.client}</option>`).join("");
  openModal("Ajouter SLA/KPI", `
    <div class="row">
      <label>Contrat<select id="sl-contract">${options}</select></label>
      <label>KPI<input id="sl-kpi" placeholder="Taux de présence…"></label>
      <label>Cible<input type="number" step="0.01" id="sl-target"></label>
      <label>Résultat<input type="number" step="0.01" id="sl-result"></label>
      <label>Unité<input id="sl-unit" value="%"></label>
      <label>Fenêtre<input id="sl-window" value="M-1"></label>
    </div>
  `, ()=>{
    state.slas.push({
      id: uid(), contract_id: byId("sl-contract").value,
      kpi: byId("sl-kpi").value.trim(),
      target: parseFloat(byId("sl-target").value||0),
      result: parseFloat(byId("sl-result").value||0),
      unit: byId("sl-unit").value.trim(),
      window: byId("sl-window").value.trim()
    });
    saveLocal(); renderSLA(); renderPenalites(); renderKPI(); drawPenaltiesChart();
  });
}
function editSLA(id){
  const sl = state.slas.find(x=>x.id===id); if(!sl) return;
  const options = state.contrats.map(c=>`<option ${c.id===sl.contract_id?"selected":""} value="${c.id}">${c.number} – ${c.client}</option>`).join("");
  openModal("Modifier SLA/KPI", `
    <div class="row">
      <label>Contrat<select id="sl-contract">${options}</select></label>
      <label>KPI<input id="sl-kpi" value="${sl.kpi}"></label>
      <label>Cible<input type="number" step="0.01" id="sl-target" value="${sl.target}"></label>
      <label>Résultat<input type="number" step="0.01" id="sl-result" value="${sl.result}"></label>
      <label>Unité<input id="sl-unit" value="${sl.unit}"></label>
      <label>Fenêtre<input id="sl-window" value="${sl.window||''}"></label>
    </div>
  `, ()=>{
    sl.contract_id = byId("sl-contract").value;
    sl.kpi = byId("sl-kpi").value.trim();
    sl.target = parseFloat(byId("sl-target").value||0);
    sl.result = parseFloat(byId("sl-result").value||0);
    sl.unit = byId("sl-unit").value.trim();
    sl.window = byId("sl-window").value.trim();
    saveLocal(); renderSLA(); renderPenalites(); renderKPI(); drawPenaltiesChart();
  });
}
function delSLA(id){
  if(!confirm("Supprimer ce KPI ?")) return;
  state.slas = state.slas.filter(x=>x.id!==id);
  saveLocal(); renderSLA(); renderPenalites(); renderKPI(); drawPenaltiesChart();
}

// ======== Pénalités ========
function estimatePenaltyForRule(rule){
  const c = state.contrats.find(x=>x.id===rule.contract_id);
  const fee = c?.monthly_fee || 0;
  let basePenalty = 0;

  // Fetch relevant KPI if trigger uses KPI
  let kpiObj = null;
  if(rule.trigger?.type?.startsWith("kpi_")){
    kpiObj = state.slas.find(s=>s.contract_id===rule.contract_id && s.kpi===rule.trigger.kpi);
  }

  if(rule.type === "fixed"){
    basePenalty = rule.params?.amount || 0;
  }
  else if(rule.type === "percent_of_fee"){
    const percent = rule.params?.percent || 0; // percent value like 0.5 for 0.5%
    // triggers: apply when below target or above target
    let apply = true;
    if(kpiObj){
      if(rule.trigger.type==="kpi_below_target"){ apply = kpiObj.result < kpiObj.target; }
      if(rule.trigger.type==="kpi_above_target"){ apply = kpiObj.result > kpiObj.target; }
    }
    basePenalty = apply ? (fee * percent / 100) : 0;
  }
  else if(rule.type === "per_unit"){
    // amount per unit over threshold (e.g., every 30 min over 120)
    if(!kpiObj) return 0;
    const overPer = rule.params?.over_per || 30; // unit size for overrun
    const amountPerUnit = rule.params?.amount_per_unit || 0;
    const over = (rule.trigger.type==="kpi_above_target") ? Math.max(0, kpiObj.result - kpiObj.target) : 0;
    const units = Math.ceil(over / overPer);
    basePenalty = units * amountPerUnit;
  }
  else if(rule.type === "graduated"){
    // tiers: [{below:95, mode:'percent_of_fee'|'fixed', value:0.3}] (percent are % of fee)
    if(!kpiObj) return 0;
    const res = kpiObj.result;
    const tiers = rule.params?.tiers || [];
    // find the tightest threshold matched
    let applied = 0;
    for(const t of tiers){
      if(t.mode==="percent_of_fee" && res < (t.below ?? 100)){
        applied = Math.max(applied, fee * (t.value||0) / 100);
      } else if(t.mode==="fixed" && res < (t.below ?? 100)){
        applied = Math.max(applied, t.value||0);
      }
    }
    basePenalty = applied;
  }

  // Apply caps
  const capAmount = rule.cap?.amount || Infinity;
  const capPct = rule.cap?.percent || Infinity; // % of monthly fee
  const capByPct = fee * (isFinite(capPct) ? capPct : 0) / 100;
  const cap = Math.min(capAmount, isFinite(capByPct) ? capByPct : Infinity);
  if(isFinite(cap)) basePenalty = Math.min(basePenalty, cap);

  return Math.max(0, Math.round(basePenalty));
}

function renderPenalites(){
  const tb = byId("table-penalites").querySelector("tbody"); tb.innerHTML="";
  const filter = byId("filter-penalite-contrat").value;
  state.penalites.forEach(p=>{
    const c = state.contrats.find(x=>x.id===p.contract_id);
    if(!c) return;
    if(filter && p.contract_id !== filter) return;
    const est = estimatePenaltyForRule(p);
    const paramsDesc = (()=>{
      if(p.type==="fixed") return `Fixe: ${fmt(p.params?.amount||0)} MAD`;
      if(p.type==="percent_of_fee") return `% CA mensuel: ${p.params?.percent||0}%`;
      if(p.type==="per_unit") return `Par ${p.params?.over_per||0} ${p.params?.unit||''}: ${fmt(p.params?.amount_per_unit||0)} MAD`;
      if(p.type==="graduated") return `Paliers: ${p.params?.tiers?.map(t=>`<${t.below}:${t.mode==='fixed'?fmt(t.value)+' MAD':t.value+'% CA'}`).join(' | ')}`;
      return "";
    })();
    const capDesc = (()=>{
      const parts=[];
      if(p.cap?.amount) parts.push(fmt(p.cap.amount)+" MAD");
      if(p.cap?.percent) parts.push((p.cap.percent)+"% CA");
      return parts.join(" / ")||"-";
    })();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.number}</td>
      <td>${p.name}</td>
      <td>${p.trigger?.type||'manual'}${p.trigger?.kpi?(' ('+p.trigger.kpi+')'):''}</td>
      <td>${p.type}</td>
      <td>${paramsDesc}</td>
      <td>${capDesc}</td>
      <td>${fmt(est)}</td>
      <td class="actions">
        <button onclick="editPenalite('${p.id}')">✎</button>
        <button onclick="delPenalite('${p.id}')">🗑️</button>
      </td>`;
    tb.appendChild(tr);
  });
}

// Modal create/edit penalty
function addPenaliteModal(){
  const options = state.contrats.map(c=>`<option value="${c.id}">${c.number} – ${c.client}</option>`).join("");
  const kpiOptions = [...new Set(state.slas.map(s=>s.kpi))].map(k=>`<option value="${k}">${k}</option>`).join("");
  openModal("Nouvelle pénalité", `
    <div class="row">
      <label>Contrat<select id="p-contract">${options}</select></label>
      <label>Nom règle<input id="p-name" placeholder="Ex: Présence < 99.5%"></label>
      <label>Déclencheur<select id="p-trigger">
        <option value="manual">Manuel</option>
        <option value="kpi_below_target">KPI < Cible</option>
        <option value="kpi_above_target">KPI > Cible</option>
      </select></label>
      <label>KPI lié<select id="p-kpi"><option value="">--</option>${kpiOptions}</select></label>
      <label>Type<select id="p-type">
        <option value="fixed">Montant fixe</option>
        <option value="percent_of_fee">% du tarif mensuel</option>
        <option value="per_unit">Par unité (dépassement)</option>
        <option value="graduated">Graduée (paliers)</option>
      </select></label>
      <label>Paramètre A<input id="p-a" placeholder="Ex: 0.5 (pour 0,5%) ou 5000 (MAD)"></label>
      <label>Paramètre B<input id="p-b" placeholder="Ex: 30 (min par palier)"></label>
      <label>Paramètre C<input id="p-c" placeholder="Ex: 500 (MAD par palier)"></label>
      <label>Plafond % CA<input id="p-cap-pct" placeholder="Ex: 10"></label>
      <label>Plafond MAD<input id="p-cap-amt" placeholder="Ex: 30000"></label>
    </div>
    <p class="hint">Rappels :<br>
      - <em>Montant fixe</em> : Param A = montant (MAD).<br>
      - <em>% du tarif</em> : Param A = pourcentage (ex: 0.5 = 0,5%).<br>
      - <em>Par unité</em> : Param A = taille de l’unité (ex: 30 min), Param C = montant par unité (MAD).<br>
      - <em>Graduée</em> : Param A = palier1 (% ou montant), Param B = palier2, Param C = ignoré (ou utilisez l’éditeur JSON avancé dans le code si besoin).
    </p>
  `, ()=>{
    const t = byId("p-type").value;
    const trig = byId("p-trigger").value;
    let trigger = {type: trig};
    const kpi = byId("p-kpi").value; if(kpi) trigger.kpi = kpi;

    let params = {};
    if(t==="fixed"){ params.amount = parseFloat(byId("p-a").value||0); }
    if(t==="percent_of_fee"){ params.percent = parseFloat(byId("p-a").value||0); }
    if(t==="per_unit"){
      params.over_per = parseFloat(byId("p-a").value||0);
      params.unit = "min";
      params.amount_per_unit = parseFloat(byId("p-c").value||0);
    }
    if(t==="graduated"){
      // For simplicity, interpret A as tier1 %, B as tier2 % with defaults
      const a = parseFloat(byId("p-a").value||0.3);
      const b = parseFloat(byId("p-b").value||0.6);
      params.tiers = [{below:95, mode:"percent_of_fee", value:a},{below:90, mode:"percent_of_fee", value:b}];
    }

    const cap = {};
    const capPct = parseFloat(byId("p-cap-pct").value||NaN);
    const capAmt = parseFloat(byId("p-cap-amt").value||NaN);
    if(!Number.isNaN(capPct)) cap.percent = capPct;
    if(!Number.isNaN(capAmt)) cap.amount = capAmt;

    state.penalites.push({
      id: uid(),
      contract_id: byId("p-contract").value,
      name: byId("p-name").value.trim(),
      trigger, type:t, params, cap
    });
    saveLocal(); renderPenalites(); renderKPI(); drawPenaltiesChart();
  });
}

function editPenalite(id){
  const p = state.penalites.find(x=>x.id===id); if(!p) return;
  const options = state.contrats.map(c=>`<option ${c.id===p.contract_id?"selected":""} value="${c.id}">${c.number} – ${c.client}</option>`).join("");
  const kpiOptions = [...new Set(state.slas.map(s=>s.kpi))].map(k=>`<option ${p.trigger?.kpi===k?"selected":""} value="${k}">${k}</option>`).join("");
  openModal("Modifier pénalité", `
    <div class="row">
      <label>Contrat<select id="p-contract">${options}</select></label>
      <label>Nom règle<input id="p-name" value="${p.name}"></label>
      <label>Déclencheur<select id="p-trigger">
        <option ${p.trigger?.type==='manual'?'selected':''} value="manual">Manuel</option>
        <option ${p.trigger?.type==='kpi_below_target'?'selected':''} value="kpi_below_target">KPI < Cible</option>
        <option ${p.trigger?.type==='kpi_above_target'?'selected':''} value="kpi_above_target">KPI > Cible</option>
      </select></label>
      <label>KPI lié<select id="p-kpi"><option value="">--</option>${kpiOptions}</select></label>
      <label>Type<select id="p-type">
        <option ${p.type==='fixed'?'selected':''} value="fixed">Montant fixe</option>
        <option ${p.type==='percent_of_fee'?'selected':''} value="percent_of_fee">% du tarif mensuel</option>
        <option ${p.type==='per_unit'?'selected':''} value="per_unit">Par unité</option>
        <option ${p.type==='graduated'?'selected':''} value="graduated">Graduée</option>
      </select></label>
      <label>Paramètre A<input id="p-a" value="${p.type==='fixed'?(p.params.amount||''):(p.type==='percent_of_fee'?(p.params.percent||''):(p.type==='per_unit'?(p.params.over_per||''):(p.params.tiers?.[0]?.value||'')))}"></label>
      <label>Paramètre B<input id="p-b" value="${p.type==='graduated'?(p.params.tiers?.[1]?.value||''):''}"></label>
      <label>Paramètre C<input id="p-c" value="${p.type==='per_unit'?(p.params.amount_per_unit||''):''}"></label>
      <label>Plafond % CA<input id="p-cap-pct" value="${p.cap?.percent||''}"></label>
      <label>Plafond MAD<input id="p-cap-amt" value="${p.cap?.amount||''}"></label>
    </div>
  `, ()=>{
    p.contract_id = byId("p-contract").value;
    p.name = byId("p-name").value.trim();
    const trig = byId("p-trigger").value;
    p.trigger = {type:trig};
    const k = byId("p-kpi").value; if(k) p.trigger.kpi = k;
    const t = byId("p-type").value;
    p.type = t;
    if(t==="fixed"){ p.params = {amount: parseFloat(byId("p-a").value||0)}; }
    if(t==="percent_of_fee"){ p.params = {percent: parseFloat(byId("p-a").value||0)}; }
    if(t==="per_unit"){ p.params = {over_per: parseFloat(byId("p-a").value||0), unit:"min", amount_per_unit: parseFloat(byId("p-c").value||0)}; }
    if(t==="graduated"){
      const a = parseFloat(byId("p-a").value||0.3);
      const b = parseFloat(byId("p-b").value||0.6);
      p.params = {tiers:[{below:95, mode:"percent_of_fee", value:a},{below:90, mode:"percent_of_fee", value:b}]};
    }
    const capPct = parseFloat(byId("p-cap-pct").value||NaN);
    const capAmt = parseFloat(byId("p-cap-amt").value||NaN);
    p.cap = {};
    if(!Number.isNaN(capPct)) p.cap.percent = capPct;
    if(!Number.isNaN(capAmt)) p.cap.amount = capAmt;
    saveLocal(); renderPenalites(); renderKPI(); drawPenaltiesChart();
  });
}
function delPenalite(id){
  if(!confirm("Supprimer cette règle ?")) return;
  state.penalites = state.penalites.filter(x=>x.id!==id);
  saveLocal(); renderPenalites(); renderKPI(); drawPenaltiesChart();
}

// ======== KPI & Chart ========
function renderKPI(){
  const active = state.contrats.length;
  const ca = state.contrats.reduce((s,c)=>s+(c.monthly_fee||0),0);
  const estPen = state.penalites.reduce((s,p)=>s+estimatePenaltyForRule(p),0);
  byId("kpi-contrats").textContent = active;
  byId("kpi-ca").textContent = fmt(ca);
  byId("kpi-penalites").textContent = fmt(estPen);
}

let chartRef = null;
function drawPenaltiesChart(){
  const ctx = byId("chart-penalites").getContext("2d");
  const labels = state.contrats.map(c=>c.number);
  const byContract = state.contrats.map(c=>{
    return state.penalites.filter(p=>p.contract_id===c.id).reduce((s,p)=>s+estimatePenaltyForRule(p),0);
  });
  if(chartRef){ chartRef.destroy(); }
  chartRef = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label:"Pénalités estimées (MAD)", data: byContract }] },
    options: { responsive:true, plugins:{legend:{display:true}}, scales:{y:{beginAtZero:true}} }
  });
}

// ======== Import/Export ========
function exportJSON(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "suivi_contrats.json";
  a.click();
}
function exportCSVContrats(){
  const cols = ["number","client","sites","type","monthly_fee","start_date","end_date","notice_days"];
  const rows = [cols.join(";")].concat(state.contrats.map(c=>cols.map(k=>c[k]??"").join(";")));
  const blob = new Blob([rows.join("\n")], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "contrats.csv";
  a.click();
}
function importJSON(file){
  const reader = new FileReader();
  reader.onload = e => { state = JSON.parse(e.target.result); saveLocal(); renderAll(); };
  reader.readAsText(file);
}

// ======== Modal generic ========
function byId(id){ return document.getElementById(id); }
function openModal(title, contentHTML, onOk){
  let modal = document.querySelector(".modal");
  if(!modal){
    modal = document.createElement("div"); modal.className = "modal";
    modal.innerHTML = `<div class="box"><h3 id="m-title"></h3><div id="m-content"></div><div class="actions"><button id="m-cancel">Annuler</button><button id="m-ok">OK</button></div></div>`;
    document.body.appendChild(modal);
  }
  byId("m-title").textContent = title;
  byId("m-content").innerHTML = contentHTML;
  modal.classList.add("active");
  byId("m-cancel").onclick = ()=> modal.classList.remove("active");
  byId("m-ok").onclick = ()=>{ modal.classList.remove("active"); if(onOk) onOk(); };
}
function bindCommon(){
  document.querySelectorAll(".tab-btn").forEach(b=>b.addEventListener("click", e=> switchTab(b.dataset.tab) ));
  byId("add-contrat").onclick = addContratModal;
  byId("search-contrat").oninput = renderContrats;
  byId("filter-alert").onchange = renderContrats;

  byId("add-clause").onclick = addClauseModal;
  byId("filter-clause-contrat").onchange = renderClauses;
  byId("search-clause").oninput = renderClauses;

  byId("add-sla").onclick = addSLAModal;
  byId("filter-sla-contrat").onchange = renderSLA;

  byId("add-penalite").onclick = addPenaliteModal;
  byId("gen-penalite").onclick = ()=>{ const sel = byId('filter-penalite-contrat'); generatePenaltiesFromClauses(sel?sel.value:null); };
  byId("filter-penalite-contrat").onchange = renderPenalites;

  byId("export-json").onclick = exportJSON;
  byId("export-doc").onclick = ()=>{ const cid = byId("export-contract").value; exportContractDoc(cid, "doc"); };
  byId("export-pdf").onclick = ()=>{ const cid = byId("export-contract").value; exportContractDoc(cid, "pdf"); };
  byId("export-csv-contrats").onclick = exportCSVContrats;
  byId("import-btn").onclick = ()=>{
    const f = byId("import-file").files[0];
    if(!f) return alert("Choisir un fichier JSON");
    importJSON(f);
  };
  byId("save-local").onclick = saveLocal;
  byId("load-local").onclick = ()=>{ loadLocal(); renderAll(); };
  byId("reset-app").onclick = resetApp;

  // Modèles: export clauses DOC/PDF
  if (byId("export-clauses-doc")) {
    byId("export-clauses-doc").onclick = ()=>{ const cid = byId("export-clauses-contract")?.value; if(!cid) return alert("Choisir un contrat"); exportClausesDoc(cid, "doc"); };
  }
  if (byId("export-clauses-pdf")) {
    byId("export-clauses-pdf").onclick = ()=>{ const cid = byId("export-clauses-contract")?.value; if(!cid) return alert("Choisir un contrat"); exportClausesDoc(cid, "pdf"); };
  }

  // Matrice: edit / restore / run
  if (byId("matrix-edit")) {
    byId("matrix-edit").onclick = ()=>{
      ensureMatrix();
      const current = JSON.stringify(state.matrix, null, 2);
      openModal("Éditer la matrice (JSON)", `<textarea id='mx-json'>${current}</textarea>`, ()=>{
        try {
          const v = JSON.parse(document.getElementById('mx-json').value);
          state.matrix = v; saveLocal();
        } catch(e){ alert("JSON invalide: "+e.message); }
      });
    };
  }
  if (byId("matrix-restore")) {
    byId("matrix-restore").onclick = ()=>{ ensureMatrix(); state.matrix = JSON.parse(JSON.stringify(defaultMatrix)); saveLocal(); alert("Matrice restaurée."); };
  }
  if (byId("matrix-run")) {
    byId("matrix-run").onclick = ()=>{
      const id = document.getElementById("matrix-contract")?.value || null;
      const n = matrixApply(id);
      alert(n + " règle(s) générée(s).");
    };
  }

}

// ======== Init ========
loadLocal();
seedIfEmpty();
bindCommon();
renderAll();


// Suggest penalty rules from clauses and SLA
function generatePenaltiesFromClauses(contractId=null){
  const targets = contractId ? state.contrats.filter(c=>c.id===contractId) : state.contrats;
  let created = 0;
  targets.forEach(c=>{
    const clauses = state.clauses.filter(cl=>cl.contract_id===c.id);
    const getKPI = name => state.slas.find(s=>s.contract_id===c.id && s.kpi===name);
    // Presence KPI
    if(clauses.some(cl=>cl.code==="OBL-RES" || cl.code==="EXP-SLA")){
      const k = getKPI("Taux de présence");
      if(k && !state.penalites.find(p=>p.contract_id===c.id && p.name.includes("Présence"))){
        state.penalites.push({ id: uid(), contract_id:c.id, name:"Présence < cible", trigger:{type:"kpi_below_target", kpi:"Taux de présence"}, type:"percent_of_fee", params:{percent:0.5}, cap:{percent:10} });
        created++;
      }
    }
    // Replacement KPI
    if(clauses.some(cl=>cl.code==="OBL-REM" || (cl.code==="OBL-RES" && (cl.variant||'').includes("Remplacement")))){
      const k = getKPI("Délai de remplacement");
      if(k && !state.penalites.find(p=>p.contract_id===c.id && p.name.includes("Remplacement"))){
        state.penalites.push({ id: uid(), contract_id:c.id, name:"Remplacement > cible", trigger:{type:"kpi_above_target", kpi:"Délai de remplacement"}, type:"per_unit", params:{unit:"min", over_per:30, amount_per_unit:500}, cap:{amount:30000} });
        created++;
      }
    }
    // Incidents closed < 24h KPI
    if(clauses.some(cl=>cl.code==="EXP-INC" || cl.code==="OBL-REP")){
      const k = getKPI("Incidents clos < 24h");
      if(k && !state.penalites.find(p=>p.contract_id===c.id && p.name.includes("Incidents"))){
        state.penalites.push({ id: uid(), contract_id:c.id, name:"Incidents < 24h non conformes", trigger:{type:"kpi_below_target", kpi:"Incidents clos < 24h"}, type:"graduated", params:{tiers:[{below:95, mode:"percent_of_fee", value:0.3},{below:90, mode:"percent_of_fee", value:0.6}]}, cap:{percent:10} });
        created++;
      }
    }
  });
  saveLocal(); renderPenalites(); renderKPI(); drawPenaltiesChart();
  alert(created ? (created + " règle(s) générée(s).") : "Aucune règle générée (vérifiez vos SLA/clauses).");
}


function contractToHTML(c){
  const clauses = state.clauses.filter(x=>x.contract_id===c.id);
  const slas = state.slas.filter(x=>x.contract_id===c.id);
  const pens = state.penalites.filter(x=>x.contract_id===c.id);
  return `
  <h1>Contrat ${c.number} – ${c.client}</h1>
  <h2>1. Informations générales</h2>
  <ul>
    <li>Sites : ${c.sites||""}</li>
    <li>Type : ${c.type||""}</li>
    <li>Tarif mensuel : ${fmt(c.monthly_fee)} MAD</li>
    <li>Période : ${c.start_date} → ${c.end_date} (Préavis ${c.notice_days||''} j)</li>
  </ul>
  <h2>2. Clauses</h2>
  <ol>${clauses.map(cl=>`<li><strong>${cl.category} – ${cl.code}</strong> – ${cl.title}${cl.variant?(" – <em>"+cl.variant+"</em>"):""} (${cl.status||"Validé"})</li>`).join("")}</ol>
  <h2>3. SLA / KPI</h2>
  <table border="1" cellspacing="0" cellpadding="4"><tr><th>KPI</th><th>Cible</th><th>Résultat</th><th>Unité</th><th>Fenêtre</th></tr>
  ${slas.map(s=>`<tr><td>${s.kpi}</td><td>${s.target}</td><td>${s.result}</td><td>${s.unit}</td><td>${s.window||""}</td></tr>`).join("")}
  </table>
  <h2>4. Pénalités</h2>
  <ol>${pens.map(p=>`<li>${p.name} — <em>${p.trigger?.type}${p.trigger?.kpi?(" ("+p.trigger.kpi+")"):""}</em> — ${p.type} — plafond: ${(p.cap?.percent? p.cap.percent+'% CA ' : '') + (p.cap?.amount? (p.cap.amount+' MAD'): '') || '-' } — estimation: ${fmt(estimatePenaltyForRule(p))} MAD</li>`).join("")}</ol>
  `;
}

function exportContractDoc(contractId, format){ // format: 'doc'|'pdf'
  const c = state.contrats.find(x=>x.id===contractId);
  if(!c) return alert("Sélectionner un contrat.");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${c.number}</title></head><body>${contractToHTML(c)}</body></html>`;

  if(format==="doc"){
    const blob = new Blob([html], {type:"application/msword"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Contrat_${c.number}.doc`;
    a.click();
    return;
  }
  if(format==="pdf"){
    if(!window.jspdf || !window.jspdf.jsPDF){ alert("jsPDF non chargé."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'pt', format:'a4'});
    // naive text rendering: strip HTML tags for PDF
    const tmp = document.createElement("div"); tmp.innerHTML = html;
    const text = tmp.innerText;
    const margin = 40, lineHeight = 14, maxWidth = 515;
    let y = margin;
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach(line=>{
      if(y > 800 - margin){ doc.addPage(); y = margin; }
      doc.text(line, margin, y); y += lineHeight;
    });
    doc.save(`Contrat_${c.number}.pdf`);
  }
}
