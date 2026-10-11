// Chamada pelo gatilho private.send_push_for_new_notifications, via pg_net.
// O banco já decidiu tokens, silêncio e badge; aqui só sai o texto e o envio.
import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import {
  buildPushMessages,
  deadPushTokens,
  type TExpoPushMessage,
} from "../_shared/domain-push.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Limite de mensagens por chamada da API do Expo.
const BATCH_SIZE = 100;

async function send(batch: TExpoPushMessage[]): Promise<string[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(batch),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("expo push falhou", response.status, JSON.stringify(body));
    return [];
  }
  const tickets = body?.data;
  if (Array.isArray(tickets)) {
    tickets.forEach((ticket, index) => {
      if (ticket?.status === "error") {
        console.error(
          "ticket com erro",
          batch[index]?.to,
          JSON.stringify(ticket)
        );
      }
    });
  }
  return deadPushTokens(batch, tickets);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_FUNCTION_SECRET");
  if (!secret || req.headers.get("x-push-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.items)) {
    console.error("corpo sem items", JSON.stringify(body));
    return new Response("bad request", { status: 400 });
  }

  const { messages, skippedIds } = buildPushMessages(body.items);
  if (skippedIds.length > 0) {
    console.error("avisos sem push (payload inválido)", skippedIds);
  }

  const dead: string[] = [];
  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    try {
      dead.push(...(await send(messages.slice(start, start + BATCH_SIZE))));
    } catch (error) {
      console.error("expo push falhou", error);
    }
  }

  if (dead.length > 0) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { error } = await supabase
      .from("push_token")
      .delete()
      .in("token", dead);
    if (error) console.error("não apagou tokens mortos", error);
  }

  return Response.json({ sent: messages.length, dead: dead.length });
});
