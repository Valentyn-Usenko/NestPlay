/* global require, process */

require('dotenv').config()

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3')

const s3 = new S3Client({
  region: process.env.AWS_REGION
})

async function testS3() {
  const bucket =
    process.env.S3_BUCKET_NAME

  const key =
    'connection-test.txt'

  console.log(
    'Testing bucket:',
    bucket
  )

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: 'GameSocial S3 test',
      ContentType: 'text/plain'
    })
  )

  console.log(
    '✅ Upload worked'
  )

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    })
  )

  console.log(
    '✅ Delete worked'
  )

  console.log(
    '✅ S3 connection is ready'
  )
}

testS3().catch(error => {
  console.error(
    '❌ S3 test failed:'
  )

  console.error(
    error
  )

  process.exit(1)
})