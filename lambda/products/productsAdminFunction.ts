import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { Lambda } from "aws-sdk";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { captureAWS } from "aws-xray-sdk-core";
import {
  ProductEvent,
  ProductEventType,
} from "/opt/nodejs/productsEventsLayer";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";

// Xray capture tracing
captureAWS(require("aws-sdk"));

const productsDdb = process.env.PRODUCTS_DDB!;
const productsEventFunctionName = process.env.PRODUCTS_EVENT_FUNCTION_NAME!;

const ddbClient = new DocumentClient();
const lambdaClient = new Lambda();
const productRepository = new ProductRepository(ddbClient, productsDdb);

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const lambdaRequestId = context.awsRequestId;
  const apiRequestId = event.requestContext.requestId;

  if (event.resource === "/products") {
    console.log("POST /products");
    const product = JSON.parse(event.body!) as Product;
    const createdProduct = await productRepository.createProduct(product);

    const response = await sendProductEvent(
      createdProduct,
      ProductEventType.CREATED,
      "lucasffm@gmail.com",
      lambdaRequestId
    );

    console.log(response);

    return {
      statusCode: 201,
      body: JSON.stringify(createdProduct),
    };
  }

  if (event.resource === "/products/{id}") {
    const productId = event.pathParameters!.id as string;
    if (event.httpMethod === "PUT") {
      console.log(`PUT /products/${productId}`);
      const product = JSON.parse(event.body!) as Product;
      try {
        const productUpdated = await productRepository.updateProduct(
          productId,
          product
        );

        const response = await sendProductEvent(
          productUpdated,
          ProductEventType.UPDATED,
          "lucasffm@gmail.com",
          lambdaRequestId
        );

        console.log(response);

        return {
          statusCode: 200,
          body: JSON.stringify(productUpdated),
        };
      } catch (error) {
        return {
          statusCode: 404,
          body: "Product Not found",
        };
      }
    }
    if (event.httpMethod === "DELETE") {
      console.log(`DELETE /products/${productId}`);
      try {
        const product = await productRepository.deleteProduct(productId);

        const response = await sendProductEvent(
          product,
          ProductEventType.DELETED,
          "lucasffm@gmail.com",
          lambdaRequestId
        );

        console.log(response);

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
  }

  return {
    statusCode: 404,
    body: JSON.stringify({
      message: "Page not found",
    }),
  };
}

function sendProductEvent(
  product: Product,
  eventType: ProductEventType,
  email: string,
  lambdaRequestId: string
) {
  const event: ProductEvent = {
    email,
    eventType,
    productCode: product.code,
    productId: product.id,
    productPrice: product.price,
    requestId: lambdaRequestId,
  };

  return lambdaClient
    .invoke({
      FunctionName: productsEventFunctionName,
      Payload: JSON.stringify(event),
      InvocationType: "RequestResponse",
    })
    .promise();
}
