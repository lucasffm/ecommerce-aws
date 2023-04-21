import { Stack, StackProps } from "aws-cdk-lib";
import {
  AccessLogFormat,
  LambdaIntegration,
  LogGroupLogDestination,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface EcommerceApiStackProps extends StackProps {
  productsFetchHandler: NodejsFunction;
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

    const productsFetchIntegration = new LambdaIntegration(
      props.productsFetchHandler
    );

    const productsResource = api.root.addResource("products");
    productsResource.addMethod("GET", productsFetchIntegration);
  }
}
