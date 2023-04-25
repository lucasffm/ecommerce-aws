import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { captureAWS } from "aws-xray-sdk-core";
import { ProductRepository } from "/opt/nodejs/productsLayer";

// Xray capture tracing
captureAWS(require("aws-sdk"));

const productsDdb = process.env.PRODUCTS_DDB!;
const ddbClient = new DocumentClient();
const productRepository = new ProductRepository(ddbClient, productsDdb);

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const lambdaRequestId = context.awsRequestId;
  const apiRequestId = event.requestContext.requestId;

  if (event.resource === "/products") {
    if (method === "GET") {
      console.log("GET /products");
      const products = await productRepository.getAllProducts();
      return {
        statusCode: 200,
        body: JSON.stringify(products),
      };
    }
  }

  if (event.resource === "/products/{id}") {
    const productId = event.pathParameters!.id as string;
    console.log(`GET /products/${productId}`);
    try {
      const product = await productRepository.getProductById(productId);

      return {
        statusCode: 200,
        body: JSON.stringify(product),
      };
    } catch (error) {
      console.error((<Error>error).message);

      return {
        statusCode: 404,
        body: (<Error>error).message,
      };
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ message: "Bad Request" }),
  };
}
