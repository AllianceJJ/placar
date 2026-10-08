/* Recarrega os dados da execucao de 05/10 e roda a Coleta antiga e a nova. */
window.preparar = async () => {
  const raw = await H.carregar('motor_raw.json');
  window.MOTOR = raw.data.resultData.runData['Motor EVO'][0].data.main[0].map(i => i.json);
  window.LEADS = await H.carregar('Motor_EVO_leads_.json');
  window.AULAS = await H.carregar('Ler_aulas_por_aluno.json');
  window.PLANO = await H.carregar('Plano_de_coleta.json');
  window.AGENDA = await H.carregar('Agenda_dos_leads.json');
  window.CALC_REAL = (await H.carregar('Calcular_indicadores.json'))[0];
  const v = await H.carregar('validar1005_raw.json');
  window.VALID_REAL = v.data.resultData.runData['Validar formato'][0].data.main[0][0].json;
  window.rodarColeta = async (pasta, opts = {}) => {
    const cod = async (n) => H.texto(pasta + '/' + n + '.js');
    const t = Date.parse(CALC_REAL.geradoEm);
    const saidas = { 'Plano de coleta': opts.plano || PLANO, 'Motor EVO': opts.motor || MOTOR, 'Agenda dos leads': opts.agenda || AGENDA, 'Motor EVO (leads)': opts.leads || LEADS, 'Ler aulas por aluno': AULAS, 'Ler leads vistos': opts.leadsVistos || [] };
    const calc = H.rodar(await cod('Calcular_indicadores'), saidas, saidas['Motor EVO (leads)'], t);
    saidas['Calcular indicadores'] = calc;
    const comp = H.rodar(await cod('Complementar_indicadores'), saidas, opts.entradaComplementar === 'leads' ? saidas['Ler leads vistos'] : AULAS, t);
    saidas['Complementar indicadores'] = comp;
    const mapa = H.rodar(await cod('Mapa_da_grade'), saidas, comp, t);
    saidas['Mapa da grade'] = mapa;
    const val = H.rodar(await cod('Validar_formato'), saidas, mapa, t);
    saidas['Validar formato'] = val;
    return { saidas, calc: calc[0], val: val[0] };
  };
  window.ANTIGO = await rodarColeta('antigo');
  const t = Date.parse(CALC_REAL.geradoEm);
  window.VISTOS = H.rodar(await H.texto('novo/Preparar_leads_vistos.js'), { 'Motor EVO': MOTOR, 'Motor EVO (leads)': LEADS }, [], t);
  window.NOVO = await rodarColeta('novo', { leadsVistos: VISTOS, entradaComplementar: 'leads' });
  return 'pronto';
};
