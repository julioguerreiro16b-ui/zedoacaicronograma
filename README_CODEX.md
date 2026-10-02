# Arquivos para trabalhar no Codex

## Arquivo principal
Use `cronograma_loja.json` como fonte de verdade estruturada.

## Arquivo de visualização
`CRONOGRAMA_LOJA.md` contém o mesmo cronograma em formato de checklist para leitura humana.

## Estrutura das tarefas
Cada tarefa possui:
- `id`: identificador único
- `area`: setor/área
- `tarefa`: descrição
- `frequencia`: diária, semanal, quinzenal ou mensal
- `momento`: abertura, durante_expediente, noite, fechamento ou a_definir
- `dias_semana`: dias em que a tarefa deve ocorrer
- `semanas_mes`: semanas do mês aplicáveis
- `prioridade`: crítica, alta ou média
- `observacao`: instruções complementares

## Sugestão de prompt para o Codex
Use o arquivo `cronograma_loja.json` como fonte de verdade do cronograma operacional.

Crie uma aplicação simples de checklist para a equipe da loja com:
1. visão "Hoje";
2. separação por Abertura, Durante o expediente, Noite e Fechamento;
3. inclusão automática das tarefas específicas do dia da semana;
4. inclusão automática das tarefas da semana do mês;
5. checkbox de conclusão;
6. responsável por tarefa;
7. horário de conclusão;
8. histórico por data;
9. destaque para tarefas críticas;
10. painel mostrando tarefas pendentes e concluídas.

Não altere o texto das tarefas sem atualizar também o JSON.
