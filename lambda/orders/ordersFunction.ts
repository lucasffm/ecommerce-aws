import { DocumentClient } from "aws-sdk/clients/dynamodb";

import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { SNS } from "aws-sdk";
import { captureAWS } from "aws-xray-sdk-core";
import { randomUUID } from "crypto";
import {
  Envelope,
  OrderEvent,
  OrderEventType,
} from "/opt/nodejs/orderEventsLayer";
import {
  CarrierType,
  OrderProductResponse,
  OrderReponse,
  OrderRequest,
  PaymentType,
  ShippingType,
} from "/opt/nodejs/ordersApiLayer";
import { Order, OrderRepository } from "/opt/nodejs/ordersLayer";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";

// Xray capture tracing
captureAWS(require("aws-sdk"));

const ordersDdb = process.env.ORDERS_DDB!;
const productsDdb = process.env.PRODUCTS_DDB!;
const orderEventsTopicArn = process.env.ORDER_EVENTS_TOPIC_ARN;

const ddbClient = new DocumentClient();
const snsClient = new SNS();

const orderRepository = new OrderRepository(ddbClient, ordersDdb);
const productRepository = new ProductRepository(ddbClient, productsDdb);

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const apiRequestId = event.requestContext.requestId;
  const lambdaRequestId = context.awsRequestId;

  console.log(
    `API Gatewat: ${apiRequestId} - LambdaRequestId: ${lambdaRequestId}`
  );

  if (method === "GET") {
    console.log("GET /orders");
    if (event.queryStringParameters) {
      const { email, orderId } = event.queryStringParameters!;
      if (email) {
        if (orderId) {
          // Get one order from an user
          try {
            const order = await orderRepository.getOrder(email, orderId);
            return {
              statusCode: 200,
              body: JSON.stringify(convertToOrderResponse(order)),
            };
          } catch (error) {
            console.log(error);
            return {
              statusCode: 404,
              body: "Product was not found",
            };
          }
        } else {
          // Get all orders from an user
          const orders = await orderRepository.getOrdersByEmail(email);
          return {
            statusCode: 200,
            body: JSON.stringify(orders.map(convertToOrderResponse)),
          };
        }
      }
    } else {
      const orders = await orderRepository.listOrders();
      return {
        statusCode: 200,
        body: JSON.stringify(orders.map(convertToOrderResponse)),
      };
    }
  }
  if (method === "POST") {
    console.log("POST /orders");
    const orderRequest = JSON.parse(event.body!) as OrderRequest;
    const products = await productRepository.getProductsByIds(
      orderRequest.productIds
    );
    if (products.length !== orderRequest.productIds.length) {
      return {
        statusCode: 404,
        body: "Some product was not found",
      };
    }

    const order = buildOrder(orderRequest, products);
    await orderRepository.createOrder(order);

    // Send Order Event to SNS
    const eventResult = await sendOrderEvent(
      order,
      OrderEventType.CREATED,
      lambdaRequestId
    );

    console.log(
      `Order created - OrderId: ${order.sk} - MessageId: ${eventResult.MessageId}`
    );

    return {
      statusCode: 201,
      body: JSON.stringify(convertToOrderResponse(order)),
    };
  }
  if (method === "DELETE") {
    console.log("DELETE /orders");
    const { email, orderId } = event.queryStringParameters!;
    try {
      const deletedOrder = await orderRepository.deleteOrder(email!, orderId!);

      const eventResult = await sendOrderEvent(
        deletedOrder,
        OrderEventType.DELETED,
        lambdaRequestId
      );

      console.log(
        `Order deleted - OrderId: ${deletedOrder.sk} - MessageId: ${eventResult.MessageId}`
      );
      return {
        statusCode: 200,
        body: JSON.stringify(convertToOrderResponse(deletedOrder)),
      };
    } catch (error) {
      console.log(error);
      return {
        statusCode: 404,
        body: "Product was not found",
      };
    }
  }

  return {
    statusCode: 400,
    body: "Bad Request",
  };
}

function sendOrderEvent(
  order: Order,
  eventType: OrderEventType,
  lambdaRequestId: string
) {
  const orderEvent: OrderEvent = {
    email: order.pk,
    orderId: order.sk!,
    billing: order.billing,
    shipping: order.shipping,
    requestId: lambdaRequestId,
    productCodes: order.products.map((item) => item.code),
  };

  const envelope: Envelope = {
    eventType,
    data: JSON.stringify(orderEvent),
  };
  return snsClient
    .publish({
      TopicArn: orderEventsTopicArn,
      Message: JSON.stringify(envelope),
    })
    .promise();
}

function buildOrder(orderRequest: OrderRequest, products: Product[]): Order {
  const orderProducts: OrderProductResponse[] = products.map((product) => ({
    code: product.code,
    price: product.price,
  }));
  const totalPrice = products.reduce((prev, curr) => prev + curr.price, 0);
  const order: Order = {
    pk: orderRequest.email,
    sk: randomUUID(),
    createdAt: Date.now(),
    billing: {
      payment: orderRequest.payment,
      totalPrice,
    },
    shipping: {
      type: orderRequest.shipping.type,
      carrier: orderRequest.shipping.carrier,
    },
    products: orderProducts,
  };

  return order;
}

function convertToOrderResponse(order: Order): OrderReponse {
  const orderProducts: OrderProductResponse[] = order.products.map(
    (product) => ({
      code: product.code,
      price: product.price,
    })
  );

  const orderResponse: OrderReponse = {
    email: order.pk,
    id: order.sk!,
    createdAt: order.createdAt!,
    products: orderProducts,
    billing: {
      payment: order.billing.payment as PaymentType,
      totalPrice: order.billing.totalPrice,
    },
    shipping: {
      carrier: order.shipping.carrier as CarrierType,
      type: order.shipping.type as ShippingType,
    },
  };

  return orderResponse;
}
