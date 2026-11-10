- db uses pg
- watch generates a hex string on setup
- mom creates an account on the website
- in her settings, she chooses which code she links her account to
- stored in uploads/user-id
- watch uses api with its hex-key, server does database lookup and sends the directory (json) over to the watch
- the header property for the api is x-api-code
- must include a filename when uploading an image to the website
- the watch app must check for new files from the directory.json and send get requests for each image it doesnt have yet

### api json format:
{
    [{filename: "example.jpg", modified: "2025-04-09 12:30:14 UTC"}, {filename: "example2.jpg", modified: "2025-04-09 12:30:14 UTC"}]
}

- if a file is downloaded locally but not on the json, delete it.
- watch must manually update images with a simple press, on the same screen as the code

### screen must look like:

   ABC1F2

| REFRESH  |


# iphone calendar integration

- It doesnt matter the name of the file itself that the mom uploads, since she will be asked to give a name to the image on the website. The system will download it on the server as the name that she input instead of filename submitted
- Then, the mom may put an event description such as:

```
Open math textbook to page 130
image: enrique
```

- She doesnt need to specify the extension, because the website will make sure names are unique across extensions (i.e. there cant be "enrique.jpg" and "enrique.webp")