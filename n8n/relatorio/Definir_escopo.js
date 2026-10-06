/* 06/10/2026: o escopo vem do GATILHO, nao do dia do mes. Antes era "dia <= 5 = mes":
   a segunda 05/10 refez o fechamento de setembro (e reescreveu os numeros dele) em vez
   de fechar a semana — e isso voltaria a acontecer em toda segunda entre os dias 1 e 5.
   Segunda 5h = semana. Dia 1o 5h = fechamento do mes anterior.
   Quando o dia 1o cai numa segunda, os dois gatilhos disparam juntos: a semanal sai sem
   fazer nada e o fechamento leva a semana junto (o bloco 'semana' vai no mesmo relatorio).
   Execucao manual: dia 1o = fechamento, qualquer outro dia = semana. */
let mensal = false, semanal = false;
try { mensal = !!$('Dia 1o 5h').isExecuted; } catch (e) { mensal = false; }
try { semanal = !!$('Segunda 5h').isExecuted; } catch (e) { semanal = false; }
const agora = new Date(Date.now() - 10800000);
const dia = agora.getUTCDate();
if (semanal && !mensal && dia === 1) return [];
const escopo = mensal ? 'mes' : (semanal ? 'semana' : (dia === 1 ? 'mes' : 'semana'));
return [{ json: { escopo } }];
