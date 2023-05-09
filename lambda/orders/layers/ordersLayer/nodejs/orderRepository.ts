import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { randomUUID } from "crypto";

export interface OrderProduct {
  code: string;
  price: number;
}

export interface Order {
  pk: string;
  sk?: string;
  createdAt?: number;
  shipping: {
    type: "URGENT" | "ECONOMIC";
    carrier: "CORREIOS" | "FEDEX";
  };
  billing: {
    payment: "CASH" | "DEBIT_CARD" | "CREDIT_CARD";
    totalPrice: number;
  };
  products: OrderProduct[];
}

export class OrderRepository {
  private ddbClient: DocumentClient;
  private ordersDdb: string;

  constructor(ddbClient: DocumentClient, ordersDdb: string) {
    this.ddbClient = ddbClient;
    this.ordersDdb = ordersDdb;
  }

  async createOrder(order: Order): Promise<Order> {
    order.sk = randomUUID();
    order.createdAt = Date.now();

    await this.ddbClient
      .put({
        TableName: this.ordersDdb,
        Item: order,
      })
      .promise();

    return order;
  }

  async listOrders(): Promise<Order[]> {
    const data = await this.ddbClient
      .scan({ TableName: this.ordersDdb })
      .promise();

    return data.Items as Order[];
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    const data = await this.ddbClient
      .query({
        TableName: this.ordersDdb,
        KeyConditionExpression: "pk = :email",
        ExpressionAttributeValues: { ":email": email },
      })
      .promise();

    return data.Items as Order[];
  }

  async getOrder(email: string, orderId: string): Promise<Order> {
    const data = await this.ddbClient
      .get({
        TableName: this.ordersDdb,
        Key: {
          pk: email,
          sk: orderId,
        },
      })
      .promise();

    if (!data.Item) {
      throw new Error("Order not found");
    }

    return data.Item as Order;
  }

  async deleteOrder(email: string, orderId: string): Promise<Order> {
    const data = await this.ddbClient
      .delete({
        TableName: this.ordersDdb,
        Key: {
          pk: email,
          sk: orderId,
        },
        ReturnValues: "ALL_OLD",
      })
      .promise();

    if (!data.Attributes) {
      throw new Error("Order not found");
    }

    return data.Attributes as Order;
  }
}
