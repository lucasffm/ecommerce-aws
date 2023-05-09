import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Code, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class OrdersAppLayersStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ordersLayer = new LayerVersion(this, "OrdersLayer", {
      layerVersionName: "OrdersLayer",
      code: Code.fromAsset("lambda/orders/layers/ordersLayer"),
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new StringParameter(this, "OrdersLayerVersionArn", {
      parameterName: "OrdersLayerVersionArn",
      stringValue: ordersLayer.layerVersionArn,
    });

    const ordersApiLayer = new LayerVersion(this, "OrdersApiLayer", {
      layerVersionName: "OrdersApiLayer",
      code: Code.fromAsset("lambda/orders/layers/ordersApiLayer"),
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new StringParameter(this, "OrdersApiLayerVersionArn", {
      parameterName: "OrdersApiLayerVersionArn",
      stringValue: ordersApiLayer.layerVersionArn,
    });
  }
}
