# Double Trouble TFT — Design do MVP

## Objetivo

Criar um aplicativo desktop para Windows 10/11 que permaneça sobre o Teamfight Tactics e permita que uma dupla de jogadores compartilhe, em tempo real, listas priorizadas de campeões e componentes desejados.

Cada usuário edita somente sua própria lista. O overlay mostra, por padrão, os pedidos do parceiro.

## Escopo do MVP

- Criar uma sala ou entrar em uma sala por UUID.
- Limitar cada sala a duas conexões ativas.
- Exibir um overlay transparente, sem moldura e sempre no topo, posicionável e redimensionável.
- Mostrar em modo compacto os pedidos priorizados do parceiro.
- Expandir o overlay para editar os próprios pedidos.
- Manter duas listas independentes: campeões e componentes.
- Aceitar no máximo dez entradas únicas em cada lista.
- Adicionar e remover entradas manualmente por busca no catálogo do set atual.
- Reordenar prioridades por arrastar e soltar.
- Sincronizar alterações entre parceiros em tempo real.
- Reconectar automaticamente após queda de rede.
- Expirar a sala 15 minutos após ambos os participantes ficarem offline.

Não fazem parte do MVP: contas, histórico, chat, notificações, integração automática com o cliente do jogo e suporte a macOS/Linux.

## Arquitetura

O aplicativo Windows será construído com Tauri e React. Tauri fornece a janela nativa do overlay; React controla as telas de sala, o estado de edição e a interface de listas.

Um serviço hospedado de tempo real gerencia a presença, o estado temporário da sala e a transmissão de atualizações. Ele é a fonte de verdade das salas, evitando a fragilidade de conexões diretas entre os PCs.

```text
Cliente A (Tauri + React) ──┐
                             ├── Serviço de salas em tempo real
Cliente B (Tauri + React) ──┘
```

O jogo deve ser usado em modo janela sem bordas para a experiência de overlay mais confiável. Em tela cheia exclusiva, o Windows pode impedir sobreposições de terceiros.

## Ciclo de vida da sala

1. O primeiro jogador escolhe **Criar sala**.
2. O serviço cria um UUID e registra o criador como primeiro participante.
3. O UUID é exibido com ação para copiar e compartilhar.
4. O parceiro escolhe **Entrar com UUID** e ocupa a segunda vaga.
5. Cada participante recebe atualizações dos pedidos do outro em tempo real.
6. Se um participante sair, seus pedidos permanecem disponíveis para o parceiro e a reconexão é permitida.
7. Quando ambos ficam offline, inicia-se um prazo de 15 minutos. Se ninguém reconectar nesse período, a sala e todos os seus dados são removidos.

O serviço rejeita UUIDs inexistentes, expirados ou salas com duas pessoas conectadas.

## Interface

### Entrada

A tela inicial oferece duas ações: **Criar sala** e **Entrar com UUID**. A entrada por UUID valida disponibilidade antes de abrir o overlay.

### Overlay compacto

O modo padrão mostra:

- Estado de conexão da dupla.
- Título “Pedidos da dupla”.
- Lista de campeões, ordenada de 1 a 10.
- Lista de componentes, ordenada de 1 a 10.
- Botão de expandir.

Listas vazias devem ter uma mensagem curta indicando que o parceiro ainda não adicionou pedidos.

### Overlay expandido

O modo expandido permite editar apenas os pedidos do usuário local:

- Busca e seleção de campeões e componentes do catálogo.
- Remoção de uma entrada.
- Reordenação por arrastar e soltar.
- Validação imediata para impedir duplicatas e mais de dez itens por categoria.

O catálogo será fornecido para o set atual de TFT e conterá ícones e nomes. Sua atualização é independente dos dados de cada sala.

## Dados e sincronização

Cada sala contém somente:

- UUID da sala.
- Identificadores temporários dos dois participantes conectados.
- Uma lista ordenada de campeões e uma de componentes para cada participante.
- Estado de presença e a marca de tempo de início da expiração, quando aplicável.

Não há contas, histórico nem dados pessoais. O cliente envia uma nova versão completa de sua própria lista a cada alteração. O serviço valida quantidade, unicidade e ordem e publica a versão confirmada ao parceiro.

Como cada jogador escreve somente as próprias listas, edições simultâneas não entram em conflito. O cliente deve tratar a confirmação do serviço como estado final.

## Falhas e recuperação

- UUID inválido, inexistente, expirado ou sala cheia: apresentar erro claro e manter o usuário na tela de entrada.
- Parceiro desconectado: mostrar “aguardando reconexão” e preservar os últimos pedidos recebidos.
- Queda de rede: tentar reconexão automática e recuperar o estado atual da sala ao reconectar.
- Falha ao salvar alteração: manter a última versão confirmada e permitir reenviar a alteração.

## Testes e validação

- Testes unitários para criação, entrada, limite de dois participantes, unicidade, máximo de dez itens, ordenação e expiração de sala.
- Testes de integração para sincronização entre dois clientes e reconexão.
- Testes de interface para criação/entrada, edição, remoção, busca e arrastar e soltar.
- Teste manual em Windows 10/11 com TFT em modo janela sem bordas, verificando visibilidade, interação e sincronização do overlay.

## Critérios de aceite

1. Dois jogadores conseguem criar e entrar na mesma sala pelo UUID.
2. Cada jogador pode definir até dez campeões únicos e dez componentes únicos em ordem de prioridade.
3. Uma alteração confirmada de um jogador aparece no overlay compacto do parceiro em tempo real.
4. O overlay continua por cima do TFT em modo janela sem bordas e pode ser expandido para edição.
5. A sala é removida 15 minutos depois de ambos ficarem offline.
