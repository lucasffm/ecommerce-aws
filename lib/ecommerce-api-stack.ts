import { Stack, StackProps } from "aws-cdk-lib";
import {
  AccessLogFormat,
  LambdaIntegration,
  LogGroupLogDestination,
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
    ordersResource.addMethod("POST", ordersIntegration);
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
    productsResource.addMethod("POST", productsAdminIntegration);
    // PUT /products/{id}
    productIdResource.addMethod("PUT", productsAdminIntegration);
    // DELETE /products/{id}
    productIdResource.addMethod("DELETE", productsAdminIntegration);
  }
}
