import { Stack, StackProps } from "aws-cdk-lib";
import {
  AccessLogFormat,
  JsonSchemaType,
  LambdaIntegration,
  LogGroupLogDestination,
  Model,
  RequestValidator,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface EcommerceApiStackProps extends StackProps {
  productsFetchHandler: NodejsFunction;
  productsAdminHandler: NodejsFunction;
  ordersHandler: NodejsFunction;
}

export class EcommerceApiStack extends Stack {
  constructor(scope: Construct, id: string, props: EcommerceApiStackProps) {
    super(scope, id, props);

    const logGroup = new LogGroup(this, "EcommerceApiLogs");

    const api = new RestApi(this, "EcommerceApi", {
      restApiName: "EcommerceApi",
      cloudWatchRole: true,
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(logGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields({
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          caller: true,
          user: true,
        }),
      },
    });

    this.createProductsService(props, api);
    this.createOrdersService(props, api);
  }

  private createOrdersService(props: EcommerceApiStackProps, api: RestApi) {
    const ordersIntegration = new LambdaIntegration(props.ordersHandler);
    // resource - /orders
    const ordersResource = api.root.addResource("orders");

    // GET /orders
    // GET /orders?email=some@mail.com
    // GET /orders?email=some@mail.com&orderId=1234
    ordersResource.addMethod("GET", ordersIntegration);
    // DELETE /orders?email=some@mail.com&orderId=1234
    const orderDeleteValidation = new RequestValidator(
      this,
      "OrderDeleteValidator",
      {
        restApi: api,
        requestValidatorName: "OrderDeleteValidator",
        validateRequestParameters: true,
      }
    );
    ordersResource.addMethod("DELETE", ordersIntegration, {
      requestParameters: {
        "method.request.querystring.email": true,
        "method.request.querystring.orderId": true,
      },
      requestValidator: orderDeleteValidation,
    });
    // POST /orders
    const orderRequestValidator = new RequestValidator(
      this,
      "OrderRequestValidator",
      {
        restApi: api,
        requestValidatorName: "OrderRequestValidator",
        validateRequestBody: true,
      }
    );

    const orderRequestModel = new Model(this, "OrderRequestModel", {
      restApi: api,
      modelName: "OrderRequestModel",
      schema: {
        type: JsonSchemaType.OBJECT,
        properties: {
          email: { type: JsonSchemaType.STRING },
          productIds: {
            type: JsonSchemaType.ARRAY,
            minItems: 1,
            items: { type: JsonSchemaType.STRING },
          },
          payment: {
            type: JsonSchemaType.STRING,
            enum: ["CASH", "DEBIT_CARD", "CREDIT_CARD"],
          },
          shipping: {
            type: JsonSchemaType.OBJECT,
            properties: {
              type: {
                type: JsonSchemaType.STRING,
                enum: ["ECONOMIC", "URGENT"],
              },
              carrier: {
                type: JsonSchemaType.STRING,
                enum: ["CORREIOS", "FEDEX"],
              },
            },
          },
        },
        required: ["email", "productIds", "payment", "shipping"],
      },
    });
    ordersResource.addMethod("POST", ordersIntegration, {
      requestValidator: orderRequestValidator,
      requestModels: {
        "application/json": orderRequestModel,
      },
    });
  }

  private createProductsService(props: EcommerceApiStackProps, api: RestApi) {
    const productsFetchIntegration = new LambdaIntegration(
      props.productsFetchHandler
    );

    const productsAdminIntegration = new LambdaIntegration(
      props.productsAdminHandler
    );

    // GET /products
    const productsResource = api.root.addResource("products");
    productsResource.addMethod("GET", productsFetchIntegration);
    // GET /products/{id}
    const productIdResource = productsResource.addResource("{id}");
    productIdResource.addMethod("GET", productsFetchIntegration);
    // POST /products
    const ProductRequestValidator = new RequestValidator(
      this,
      "ProductRequestValidator",
      {
        restApi: api,
        requestValidatorName: "ProductRequestValidator",
        validateRequestBody: true,
      }
    );
    const productRequestModel = new Model(this, "ProductRequestModel", {
      restApi: api,
      modelName: "ProductRequestModel",
      schema: {
        type: JsonSchemaType.OBJECT,
        properties: {
          productName: { type: JsonSchemaType.STRING },
          price: { type: JsonSchemaType.NUMBER },
          code: { type: JsonSchemaType.STRING },
          model: { type: JsonSchemaType.STRING },
          productUrl: { type: JsonSchemaType.STRING },
        },
        required: ["productName", "price", "code"],
      },
    });

    productsResource.addMethod("POST", productsAdminIntegration, {
      requestValidator: ProductRequestValidator,
      requestModels: {
        "application/json": productRequestModel,
      },
    });

    // PUT /products/{id}
    productIdResource.addMethod("PUT", productsAdminIntegration, {
      requestValidator: ProductRequestValidator,
      requestModels: {
        "application/json": productRequestModel,
      },
    });
    // DELETE /products/{id}
    productIdResource.addMethod("DELETE", productsAdminIntegration);
  }
}
