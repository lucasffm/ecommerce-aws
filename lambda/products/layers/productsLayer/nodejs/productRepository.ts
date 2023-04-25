import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { randomUUID } from "crypto";
export interface Product {
  id: string;
  productName: string;
  code: string;
  price: number;
  model: string;
  productUrl: string;
}

export class ProductRepository {
  private ddbClient: DocumentClient;
  private productsDdb: string;

  constructor(ddbClient: DocumentClient, productsDdb: string) {
    this.ddbClient = ddbClient;
    this.productsDdb = productsDdb;
  }

  async getAllProducts(): Promise<Product[]> {
    const { Items } = await this.ddbClient
      .scan({ TableName: this.productsDdb })
      .promise();

    return Items as Product[];
  }

  async getProductById(id: string): Promise<Product> {
    const data = await this.ddbClient
      .get({
        TableName: this.productsDdb,
        Key: {
          id,
        },
      })
      .promise();

    if (!data.Item) {
      throw new Error("Product not found");
    }

    return data.Item as Product;
  }

  async createProduct(product: Product): Promise<Product> {
    product.id = randomUUID();
    await this.ddbClient
      .put({
        TableName: this.productsDdb,
        Item: product,
      })
      .promise();

    return product;
  }

  async deleteProduct(id: string): Promise<Product> {
    const data = await this.ddbClient
      .delete({
        TableName: this.productsDdb,
        Key: {
          id,
        },
        ReturnValues: "ALL_OLD",
      })
      .promise();

    if (!data.Attributes) {
      throw new Error("Product not found");
    }

    return data.Attributes as Product;
  }

  async updateProduct(id: string, product: Product): Promise<Product> {
    const data = await this.ddbClient
      .update({
        TableName: this.productsDdb,
        Key: {
          id,
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "UPDATED_NEW",
        UpdateExpression:
          "set productName = :n, code = :c, price = :p, model = :m, productUrl = :u",
        ExpressionAttributeValues: {
          ":n": product.productName,
          ":c": product.code,
          ":p": product.price,
          ":m": product.model,
          ":u": product.productUrl,
        },
      })
      .promise();

    data.Attributes!.id = id;
    return data.Attributes as Product;
  }
}
