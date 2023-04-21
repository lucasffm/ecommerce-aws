import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class ProductsAppStack extends Stack {
  readonly productsFetchHandler: NodejsFunction;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.productsFetchHandler = new NodejsFunction(
      this,
      "ProductsFetchFunction",
      {
        functionName: "ProductsFetchFunction",
        entry: "lambda/products/productsFetchFunction.ts",
        handler: "handler",
        memorySize: 128,
        timeout: Duration.seconds(5),
        bundling: {
          minify: true,
          sourceMap: false,
        },
      }
    );
  }
}
