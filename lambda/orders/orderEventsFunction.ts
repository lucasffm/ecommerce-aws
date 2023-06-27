import { Context, SNSEvent, SNSMessage } from "aws-lambda";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import * as AWSXRay from "aws-xray-sdk";
import { Envelope, OrderEvent } from "/opt/nodejs/orderEventsLayer";
import { OrderEventRepository } from "/opt/nodejs/orderEventsRepositoryLayer";

AWSXRay.captureAWS(require("aws-sdk"));

const eventsDdb = process.env.EVENTS_DDB!;
const ddbClient = new DocumentClient();
const orderEventsRepository = new OrderEventRepository(ddbClient, eventsDdb);

export async function handler(
  event: SNSEvent,
  context: Context
): Promise<void> {
  const promises = event.Records.map(async (record) => {
    await createEvent(record.Sns);
  });

  await Promise.all(promises);

  return;
}

function createEvent(body: SNSMessage) {
  const envelope = JSON.parse(body.Message) as Envelope;
  const event = JSON.parse(envelope.data) as OrderEvent;
  console.log(`Order Event - MessageId: ${body.MessageId}`);

  const timestamp = Date.now();

  return orderEventsRepository.createOrderEvent({
    pk: `#order_${event.orderId}`,
    sk: `${envelope.eventType}#${timestamp}`,
    email: event.email,
    createdAt: timestamp,
    requestId: event.requestId,
    eventType: envelope.eventType,
    ttl: timestamp / 1000 + 5 * 60,
    info: {
      messageId: body.MessageId,
      orderId: event.orderId,
      productCodes: event.productCodes,
    },
  });
}
