#!/usr/bin/env node
console.log("Running Conversion");

const AWS = require("aws-sdk");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const s3 = new AWS.S3();
const args = require("yargs")
  .option("bucket", {
    alias: "b",
    describe: "URL of AWS bucket"
  })
  .option("host", {
    alias: "h",
    describe: "URL hosting the flask proxy"
  })
  .option("secret", {
    alias: "s",
    describe: "Secret used to generate JWT token"
  })
  .option("output", {
    alias: "o",
    describe: "Filepath to output result"
  })
  .demandOption(["bucket", "host", "secret", "output"])
  .help().argv;

const mapToUrl = ({ key, bucket, externalId }) => {
  const encoded = jwt.sign({ key, bucket }, args["secret"], {
    expiresIn: "100y"
  });

  return { externalId, imageUrl: `${args.host}?token=${encoded}` };
};

const generateKeyBucketPairs = async bucket => {
  const params = {
    Bucket: bucket
  };
  let content = [];
  const gatherUrlsFromBucket = new Promise((resolve, reject) => {
    s3.listObjectsV2(params).eachPage((err, data, done) => {
      if (err) {
        reject(err);
      }
      if (data) {
        content = [
          ...content,
          ...data.Contents.map(({ Key }) => ({
            key: Key,
            bucket,
            externalId: Key
          }))
        ];
      }
      if (data === null) {
        const urls = content.map(mapToUrl);
        resolve(urls);
      }
      done();
    });
  });

  return await gatherUrlsFromBucket;
};

const writeToOutput = async () => {
  const json = await generateKeyBucketPairs(args.bucket);

  fs.writeFile(args.output, JSON.stringify(json), err => {
    if (err) {
      throw err;
    }

    console.log("The data has been saved");
  });
};

writeToOutput();
