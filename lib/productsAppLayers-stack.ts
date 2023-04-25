import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Code, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class ProductsAppLayersStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const productsLayers = new LayerVersion(this, "ProductsLayer", {
      code: Code.fromAsset("lambda/products/layers/productsLayer"),
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      layerVersionName: "ProductsLayer",
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new StringParameter(this, "ProductsLayerVersionArn", {
      parameterName: "ProductsLayerVersionArn",
      stringValue: productsLayers.layerVersionArn,
    });

    const productEventsLayers = new LayerVersion(this, "ProductsEventsLayer", {
      code: Code.fromAsset("lambda/products/layers/productsEventsLayer"),
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      layerVersionName: "ProductsEventsLayer",
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new StringParameter(this, "ProductsEventsLayerVersionArn", {
      parameterName: "ProductsEventsLayerVersionArn",
      stringValue: productEventsLayers.layerVersionArn,
    });
  }
}
