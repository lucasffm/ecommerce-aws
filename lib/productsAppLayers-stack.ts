import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Code, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class ProductsAppLayersStack extends Stack {
  readonly productsLayers: LayerVersion;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.productsLayers = new LayerVersion(this, "ProductsLayer", {
      code: Code.fromAsset("lambda/products/layers/productsLayer"),
      compatibleRuntimes: [Runtime.NODEJS_18_X],
      layerVersionName: "ProductsLayer",
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new StringParameter(this, "ProductsLayerVersionArn", {
      parameterName: "ProductsLayerVersionArn",
      stringValue: this.productsLayers.layerVersionArn,
    });
  }
}
