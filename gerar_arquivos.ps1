$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$utf8 = [System.Text.UTF8Encoding]::new($false)
$json = [System.IO.File]::ReadAllText((Join-Path $taskRoot 'cronograma_loja.json'), [System.Text.Encoding]::UTF8)
$source = $json | ConvertFrom-Json
$logo = 'data:image/jpeg;base64,' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $taskRoot 'referencia_logo_ifood.jpg')))
$template = [System.IO.File]::ReadAllText((Join-Path $taskRoot 'painel.template.html'), [System.Text.Encoding]::UTF8)
$panel = $template.Replace('__DATA__', $json).Replace('__LOGO__', $logo)
[System.IO.File]::WriteAllText((Join-Path $taskRoot 'index.html'), $panel, $utf8)

function Escape-Html([string]$value) { [System.Net.WebUtility]::HtmlEncode($value) }
function Task-Rows($list) {
    $rows = foreach ($task in $list) {
        $priority = if ($task.prioridade -eq 'critica') { '<span class="critical">CRÍTICA</span>' } elseif ($task.prioridade -eq 'alta') { '<span class="high">ALTA</span>' } else { '' }
        $note = if ($task.id -eq 'DIA-ABR-005') { '<small>Aplicar às produções novas. Manter a identificação atualizada.</small>' } else { '' }
        '<tr data-task="' + $task.id + '"><td class="box">□</td><td class="tasktext">' + (Escape-Html $task.tarefa) + $note + '</td><td class="priority">' + $priority + '</td><td class="fill">____________</td><td class="time">____:____</td></tr>'
    }
    $rows -join "`n"
}
function Block-Html([string]$title, [string]$subtitle, $list, [string]$style='') {
    '<section class="block ' + $style + '"><div class="block-title"><h2>' + $title + '</h2><span>' + $subtitle + '</span></div><table><thead><tr><th></th><th>Tarefa</th><th></th><th>Responsável</th><th>Hora</th></tr></thead><tbody>' + (Task-Rows $list) + '</tbody></table></section>'
}
$open = Block-Html '01 · Abertura' 'Antes do atendimento' @($source.tarefas | Where-Object momento -eq 'abertura')
$during = Block-Html '02 · Durante o expediente' 'Conferir no turno e repetir ao longo do dia' @($source.tarefas | Where-Object momento -eq 'durante_expediente')
$night = Block-Html '03 · Noite' 'Preferencialmente no período da noite' @($source.tarefas | Where-Object momento -eq 'noite')
$close = Block-Html '04 · Fechamento' 'Antes de a última pessoa sair' @($source.tarefas | Where-Object momento -eq 'fechamento') 'closing'
$mwf = Block-Html 'Segunda · Quarta · Sexta' 'Executar em cada um desses dias' @($source.tarefas | Where-Object { $_.frequencia -eq 'semanal' -and $_.dias_semana -contains 'segunda' })
$tt = Block-Html 'Terça · Quinta' 'Executar em cada um desses dias' @($source.tarefas | Where-Object { $_.frequencia -eq 'semanal' -and $_.dias_semana -contains 'terca' })
$monthly = Block-Html '1ª semana · Dias 1 a 7' 'Uma vez no período · mensal' @($source.tarefas | Where-Object frequencia -eq 'mensal') 'monthly'
$fortnight = Block-Html '2ª e 4ª semanas · Dias 8–14 e 22–28' 'Uma vez em cada período · quinzenal' @($source.tarefas | Where-Object frequencia -eq 'quinzenal') 'monthly'
$poster = @"
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cronograma completo · Zé do Açaí</title><style>
@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#e8e5e7;color:#3e2038;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:210mm;height:297mm;padding:13mm 13mm 10mm;background:#fff;margin:20px auto;display:flex;flex-direction:column;overflow:hidden;position:relative}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e8e1e6;padding-bottom:9px}.top img{width:59px;height:59px;object-fit:cover}.brand{display:flex;align-items:center;gap:9px}.brand b{font-size:17px}.kicker{font-size:8px;letter-spacing:1.7px;text-transform:uppercase;font-weight:800;color:#7b3067}.top .count{font-size:9px;color:#7d727a}.hero{background:#7b3067;border-radius:13px;padding:19px 22px;color:white;margin:16px 0}.hero .kicker{color:#d5e67d}h1{font-size:29px;letter-spacing:-1px;line-height:1.08;margin:7px 0 8px}.hero p{font-size:10px;line-height:1.6;margin:0;color:#f5eaf2}.blanks{display:flex;justify-content:space-between;font-size:9px;margin-bottom:13px;color:#6c5a66}.block{border:1px solid #e7e0e5;border-radius:10px;overflow:hidden;margin-bottom:10px;break-inside:avoid}.block-title{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f4ecf1;padding:9px 11px}h2{font-size:12px;margin:0;color:#7b3067}.block-title span{font-size:8px;color:#786571}.closing .block-title{background:#fbecee}.closing h2{color:#a93846}.monthly .block-title{background:#eff3da}.monthly h2{color:#426f2c}table{width:100%;border-collapse:collapse;table-layout:fixed}th{text-align:left;color:#998591;font-size:7px;font-weight:600;padding:5px 9px 2px}th:first-child{width:28px}th:nth-child(3){width:49px}th:nth-child(4){width:90px}th:nth-child(5){width:62px}td{padding:6px 8px;border-top:1px solid #f0eaf0;font-size:10px;line-height:1.4;vertical-align:middle}.box{font-size:17px;color:#7b3067;padding-left:11px}.tasktext{font-weight:550}.fill,.time{font-size:9px;color:#bba9b4}.critical,.high{font-size:6px;font-weight:800;border-radius:4px;padding:3px 4px;background:#fae1e3;color:#a93846}.high{background:#f4efca;color:#736326}small{display:block;font-size:8px;color:#86717e;font-weight:400;margin-top:2px}.rules{display:flex;gap:13px;background:#d5e67d;border-radius:10px;padding:12px 14px;margin-top:1px}.rules>div{flex:1}.rules b{display:block;font-size:10px;color:#355522;margin-bottom:4px}.rules p{font-size:9px;line-height:1.5;margin:0;color:#3f5630}.sign{display:flex;justify-content:space-between;font-size:9px;margin-top:15px}.footer{margin-top:auto;display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e7e0e5;padding-top:9px;font-size:8px;color:#8d7887}.note{font-size:8px;line-height:1.6;color:#7d6675;margin:2px 0 11px}.second .hero{padding:17px 22px;margin:14px 0}.second h1{font-size:27px}.second td{padding:8px}.second .block{margin-bottom:9px}.second .block-title{padding:9px 11px}.second .blanks{margin-bottom:12px}.screen-help{max-width:210mm;margin:20px auto;font-size:13px;line-height:1.6}.screen-help button{background:#7b3067;border:0;border-radius:8px;color:white;padding:10px 16px;cursor:pointer}@media print{body{background:white}.page{margin:0;break-after:page}.page:last-of-type{break-after:auto}.screen-help{display:none}}@media(max-width:820px){body{overflow:auto}.page{margin:12px auto}.screen-help{padding:0 15px}}
.page>*{flex-shrink:0}.hero,.second .hero{padding:13px 20px;margin:12px 0}h1,.second h1{font-size:27px;margin:5px 0 7px}.hero p{line-height:1.5}.block td,.second .block td{font-size:11px;padding:7px 8px}.block .box{font-size:14px;line-height:1}.block .fill,.block .time{font-size:9px}.block-title,.second .block-title{padding:8px 11px}
@media print{.page{height:296mm;margin:0}}
</style></head><body><div class="screen-help"><button onclick="window.print()">Imprimir / salvar PDF</button> · A4 vertical · duas páginas · impressão colorida recomendada.</div>
<article class="page"><header class="top"><div class="brand"><img src="$logo" alt="Zé do Açaí"><div><b>Zé do Açaí</b><div class="kicker">Cronograma da equipe</div></div></div><span class="count">01 / 02 · ROTINA DIÁRIA</span></header>
<div class="hero"><span class="kicker">Um cuidado de cada vez</span><h1>Todo dia.<br>Todo cuidado.</h1><p>Abertura, atendimento, reposição e fechamento.<br>Marque ao concluir e identifique quem conferiu.</p></div>
<div class="blanks"><span>Data: ____ / ____ / ______</span><span>Equipe / turno: ______________________________</span></div>
$open
$during
$night
$close
<div class="rules"><div><b>Cremes na geladeira</b><p>Terminou os pedidos? Guarde imediatamente.</p></div><div><b>Validade de 3 dias</b><p>Etiquete as produções novas e mantenha a identificação atualizada.</p></div><div><b>Última conferência</b><p>Revise os itens críticos de fechamento antes de a última pessoa sair.</p></div></div>
<div class="sign"><span>Conferência final: _____________________________</span><span>Horário: _____:_____</span></div>
<footer class="footer"><span>Rotina diária de segunda a domingo, conforme o arquivo da loja.</span><span>13 tarefas · Cuidado que vira rotina.</span></footer></article>
<article class="page second"><header class="top"><div class="brand"><img src="$logo" alt="Zé do Açaí"><div><b>Zé do Açaí</b><div class="kicker">Cronograma da equipe</div></div></div><span class="count">02 / 02 · CUIDADOS PROGRAMADOS</span></header>
<div class="hero"><span class="kicker">Limpeza e organização</span><h1>Uma loja no capricho.<br>Uma semana organizada.</h1><p>Some estas tarefas à rotina diária.<br>Combine o horário e o responsável antes de começar.</p></div>
<div class="blanks"><span>Semana / período: ____________________</span><span>Mês / ano: ____________________</span></div>
$mwf
$tt
$monthly
$fortnight
<p class="note"><b>Como contar as semanas:</b> 1ª = dias 1–7; 2ª = 8–14; 3ª = 15–21; 4ª = 22–28; 5ª = 29 até o fim do mês. Critério adotado para organizar os períodos do ZIP. Na 3ª e 5ª semanas, manter a rotina diária e semanal.</p>
<div class="rules"><div><b>Sábado e domingo</b><p>Rotina diária completa. Acrescente os cuidados mensais ou quinzenais se estiverem no período indicado.</p></div><div><b>Sem horário fixo</b><p>Os horários de limpeza e os responsáveis são definidos pela equipe.</p></div></div>
<footer class="footer"><span>Use uma cópia por dia programado ou período de conferência.</span><span>12 tarefas adicionais · Frequências preservadas.</span></footer></article></body></html>
"@
[System.IO.File]::WriteAllText((Join-Path $taskRoot 'cronograma_para_imprimir.html'), $poster, $utf8)
$readme = @'
CRONOGRAMA OPERACIONAL — ZÉ DO AÇAÍ

Abra o endereço do site para compartilhar os registros. Abrir index.html diretamente funciona apenas em modo local.

Dia: tarefas da abertura, expediente, noite e fechamento, somadas aos cuidados programados da data escolhida. Informe obrigatoriamente o nome de quem fez antes de concluir a tarefa. O horário de conclusão é registrado automaticamente.
Semana: visão dos cuidados adicionais de segunda a domingo.
Mês: tarefas mensais e quinzenais por período.
Histórico: registros de conclusão e responsáveis, com filtro implícito por tarefa preenchida.

IMPRESSÃO
cronograma_para_imprimir.pdf: cronograma completo em duas páginas A4 verticais.
cronograma_para_imprimir.html: mesma versão para imprimir pelo navegador.
No painel, Imprimir imprime a visão atual. Para um checklist de uma data específica, selecione a data, abra Dia e escolha o filtro Todas antes de imprimir.

PERÍODOS
1ª semana = dias 1–7; 2ª = 8–14; 3ª = 15–21; 4ª = 22–28; 5ª = 29 até o fim.
Este critério foi adotado para tornar objetiva a expressão "semana do mês" do ZIP.
Tarefas mensais e quinzenais ficam pendentes até serem feitas, inclusive após o período programado. Ganham destaque na semana programada e ficam como atrasadas depois dela. Ao concluir, saem do checklist e permanecem no Histórico.
A limpeza semanal é exigida em cada dia indicado no arquivo original. Ocorrências não feitas continuam pendentes nos dias seguintes, identificadas pela data prevista.
Os dias de funcionamento seguem o ZIP: tarefas diárias de segunda a domingo. Horários específicos e nomes não foram informados; a equipe define o momento da limpeza e preenche os responsáveis.
As duas tarefas de expediente são cuidados contínuos. Marcar o checklist registra a conferência do dia, sem encerrar a obrigação de repetir esses cuidados.

REGISTROS
Os dados são compartilhados entre computadores quando o banco online está configurado. Em cada computador, abra o mesmo site e informe o código da loja em Conectar equipe. O indicador confirma quando os registros estão sincronizados; a consulta é atualizada a cada 10 segundos. Sem conexão, a cópia local e a fila de alterações ficam no navegador para reenvio. A configuração do banco Supabase e da Vercel está no README.md.
Exportar salva uma cópia JSON. Importar aceita cópias antigas e novas. Conflitos de importação ou alterações simultâneas são exibidos para a equipe escolher qual versão manter; não há substituição silenciosa. Conclusões antigas sem nome voltam a ficar pendentes para conferência.
Se o navegador impedir o armazenamento, aparece um aviso. Nesse caso, exporte antes de fechar.
Uma tarefa reaberta perde sua marcação e horário de conclusão; o histórico mostra o estado atual de cada ocorrência, não um registro de todas as edições.
A data da tarefa é a data selecionada. A data e hora reais da conferência aparecem no Histórico, no fuso America/Sao_Paulo.

CONTEÚDO E IDENTIDADE
O cronograma contém 25 tarefas e três regras. A tarefa de tirar o lixo e limpar lixeiras foi adicionada ao fechamento diário. O cronograma_loja.json permanece a fonte das tarefas.
A regra de validade de três dias foi reproduzida do material da loja; não foi determinada por este painel.
O Instagram @zedoacai.nf não pôde ser consultado. A paleta roxa, verde e amarelo-lima foi inspirada no logotipo público do Zé do Açaí no iFood:
https://www.ifood.com.br/delivery/nova-friburgo-rj/ze-do-acai-centro/33a2abd6-e622-4c02-a776-10ede491fa15

ARQUIVOS DE APOIO
cronograma_loja.json e CRONOGRAMA_LOJA.md: rotina original com as atualizações solicitadas. README_CODEX.md: instruções originais.
painel.template.html e gerar_arquivos.ps1: arquivos usados para gerar os documentos. Após alterar as tarefas no JSON, execute gerar_arquivos.ps1 para atualizar os HTMLs. O PDF precisa ser gerado novamente pelo navegador.
'@
[System.IO.File]::WriteAllText((Join-Path $taskRoot 'LEIA_ME.txt'), $readme, $utf8)
Write-Output ('Gerados: index.html, cronograma_para_imprimir.html e LEIA_ME.txt. Tarefas: ' + $source.tarefas.Count)
