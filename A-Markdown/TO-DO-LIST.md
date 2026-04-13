1. 
2. В поле "способы оплаты" удалить Kaspi QR
3. Заметил, что когда товар загружен на склад через эксель, через наш умный робот, то у менеджера если он есть в наличии – выходит "умный склад", вместо этого просто надо поставить зелёным "есть в наличии".
4. 





Chat System — Development Roadmap

Phase 6 — Group Conversations (future)
Schema already supports N participants via ConversationParticipant[]
Add POST /chat/conversations/ body: { participant_ids: string[] } (array, not single)
Add name?: string field to Conversation for named group chats
UI: ConvItem shows multiple avatars stacked; ThreadHeader shows group name or participant list
Dependency summary
What	Where	Status
@fastify/websocket	server/package.json	needs install
Prisma models + migration	server/prisma/	needs authoring
chat.routes.ts + chat.service.ts	server/src/modules/chat/	needs authoring
chat.ws.ts	server/src/modules/chat/	needs authoring
Register module in server/src/app.ts	server/src/app.ts	needs edit
useChatSocket hook + mount in AppShell	src/features/chat/	needs authoring
Read receipt call in ChatModal	src/features/chat/ChatModal.tsx	needs edit
Optimistic send in hooks.ts	src/features/chat/hooks.ts	needs edit
Cursor pagination in MessageThread	src/features/chat/ChatModal.tsx	needs edit
