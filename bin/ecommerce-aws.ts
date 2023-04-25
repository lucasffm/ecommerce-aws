#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { EcommerceApiStack } from "../lib/ecommerce-api-stack";
import { ProductsAppStack } from "../lib/products-app-stack";
import { ProductsAppLayersStack } from "../lib/productsAppLayers-stack";

const app = new cdk.App();
const env: cdk.Environment = {
  account: "556280449646",
  region: "us-east-1",
};

const tags = {
  cost: "Ecommerce",
  team: "MeuTime",
};

const productsAppLayersStack = new ProductsAppLayersStack(
  app,
  "ProductsAppLayersStack",
  {
    tags,
    env,
  }
);

const productsAppStack = new ProductsAppStack(app, "ProductsApp", {
  tags,
  env,
});

productsAppStack.addDependency(productsAppLayersStack);

const ecommerceApiStack = new EcommerceApiStack(app, "EcommerceApi", {
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  tags,
  env,
});

ecommerceApiStack.addDependency(productsAppStack);
