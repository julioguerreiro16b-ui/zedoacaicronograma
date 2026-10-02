# Cronograma Zé do Açaí

Painel de checklist para a equipe da loja, com 25 tarefas de operação, limpeza e organização. O cronograma preserva as tarefas e frequências do material fornecido pela loja.

Abra [index.html](index.html) no navegador para usar o painel. A aplicação funciona sem instalação e sem dependências externas.

- **Dia:** abertura, expediente, noite, fechamento e cuidados programados da data.
- **Semana e mês:** visão dos cuidados recorrentes e dos períodos de execução.
- **Conferências:** responsável, horário de conclusão e destaque para tarefas críticas.
- **Histórico:** estado atual das tarefas preenchidas, com exportação e importação em JSON.

Os registros ficam no navegador e dispositivo usados. Use **Exportar** para guardar uma cópia ou transferir os dados. A importação une os registros e, em conflitos, usa a versão do arquivo importado.

## Deploy na Vercel

1. Na Vercel, crie um projeto e importe `julioguerreiro16b-ui/zedoacaicronograma` do GitHub.
2. Use a branch `main`, **Framework Preset: Other** e **Root Directory: .** (raiz do repositório, onde está `vercel.json`).
3. Mantenha os comandos e a pasta de saída definidos pelo `vercel.json` e clique em **Deploy**. Não são necessárias variáveis de ambiente nem dependências.

A configuração copia os arquivos já gerados para `public/`: o painel `index.html`, a versão de impressão `cronograma_para_imprimir.html` e o PDF `cronograma_para_imprimir.pdf`. Apenas esses arquivos são publicados. O build usa os comandos de shell disponíveis na Vercel; não depende de PowerShell, Python ou Chrome no servidor. Referência: [configuração de build da Vercel](https://vercel.com/docs/builds/configure-a-build).

Após publicar, confira `/`, `/cronograma_para_imprimir.html` e `/cronograma_para_imprimir.pdf`. Marque uma tarefa no painel, recarregue a página e verifique a persistência. Experimente também exportar e importar uma cópia dos registros.

Os registros continuam salvos no navegador, por endereço do site, sem sincronização entre dispositivos. Para levar os registros locais ao site, use **Exportar** no painel antigo e **Importar cópia** no endereço definitivo. Endereços de preview e domínios diferentes mantêm registros separados.

Para atualizar as tarefas, execute `gerar_arquivos.ps1` localmente e atualize o PDF conforme as instruções de manutenção abaixo. Envie os arquivos gerados para `main`; com a integração GitHub da Vercel configurada, esse envio dispara o próximo deploy.

## Impressão

O [PDF completo](cronograma_para_imprimir.pdf) tem duas páginas A4 verticais. A [versão HTML para impressão](cronograma_para_imprimir.html) permite imprimir pelo navegador. No painel, o botão **Imprimir** imprime a visão selecionada.

![Rotina diária](docs/previa_pdf_pagina_1.png)

![Cuidados semanais, quinzenais e mensais](docs/previa_pdf_pagina_2.png)

## Frequências

As tarefas diárias seguem de segunda a domingo. A limpeza semanal ocorre em cada um dos dias indicados na fonte: segunda/quarta/sexta e terça/quinta.

Para organizar as semanas do mês, o painel usa blocos contados a partir do dia 1:

| Semana | Dias | Cuidados adicionais |
| --- | --- | --- |
| 1ª | 1–7 | Vidros internos e externos, uma vez no período |
| 2ª | 8–14 | Freezers e trilhos, uma vez no período |
| 3ª | 15–21 | Rotina diária e semanal |
| 4ª | 22–28 | Freezers e trilhos, uma vez no período |
| 5ª | 29 até o fim | Rotina diária e semanal |

A conclusão mensal ou quinzenal vale para todos os dias daquele período. Os cuidados de expediente continuam ao longo do turno, mesmo após a marcação de conferência.

## Arquivos e manutenção

[cronograma_loja.json](cronograma_loja.json) é a fonte das tarefas. [CRONOGRAMA_LOJA.md](CRONOGRAMA_LOJA.md) e [README_CODEX.md](README_CODEX.md) são os documentos originais fornecidos pela loja. [LEIA_ME.txt](LEIA_ME.txt) reúne as instruções de uso.

Após alterar o JSON, execute `gerar_arquivos.ps1` no PowerShell para atualizar `index.html` e `cronograma_para_imprimir.html`. O PDF precisa ser gerado novamente pela versão de impressão do navegador. Mantenha as duas imagens em `docs/` atualizadas com o PDF.

`verificar.cjs` verifica frequências, persistência, histórico, filtros, adaptação às telas e paginação; requer Node.js e uma instância de Chrome com depuração local na porta 9222. `renderizar_pdf.py` renderiza o PDF e confere o texto das 25 tarefas, usando Python e o PDFium instalado pelo LibreOffice no Windows. Esses scripts foram usados na validação dos arquivos entregues.

## Identidade visual

O roxo, verde e amarelo-lima foram inspirados no [logotipo público do Zé do Açaí no iFood](https://www.ifood.com.br/delivery/nova-friburgo-rj/ze-do-acai-centro/33a2abd6-e622-4c02-a776-10ede491fa15). O perfil Instagram `@zedoacai.nf` não pôde ser consultado durante a criação.

Os horários específicos e os responsáveis são definidos pela equipe. A validade de três dias dos cremes reproduz a regra informada pela loja no arquivo original.
