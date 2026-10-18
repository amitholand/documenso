# Creating Documents with Signature Types via the API

Signature fields can have their own **label** and their own **allowed signature types**.
Use this to require two signatures on one document: a regular signature and a company stamp (uploaded image only).

Base URL: `https://yazamco-documenso.up.railway.app/api/v2`

Authentication: create an API token in **Settings → API Tokens**, then send it as:

```
Authorization: api_xxxxxxxxxxxxxxxx
```

---

## The signature field options

On any field with `"type": "SIGNATURE"`, set `fieldMeta`:

| Property | Type | Description |
|---|---|---|
| `type` | `"signature"` | Required inside `fieldMeta`. |
| `label` | string | Shown on the field and as the title of the signing dialog (e.g. `"חותמת"`). |
| `signatureTypes` | array of `"draw"`, `"type"`, `"upload"` | Signature types allowed for **this field only**. At least one value. Overrides the document's signature settings. |
| `required` | boolean | Optional. |

Behaviour:

- `signatureTypes` left out → the field uses the document's signature settings (as before).
- `["upload"]` → the signer can only upload an image. Use this for the company stamp.
- `["draw"]` → the signer can only draw.
- A field with its own `signatureTypes` never reuses the signer's other signature, so the stamp and the signature stay separate.
- The server checks the value on signing. A drawn signature is rejected on an upload-only field, and the other way round.

---

## Create a document with a signature and a stamp

`POST /envelope/create`, sent as `multipart/form-data` with two parts:

- `payload`: JSON (below)
- `files`: the PDF

Positions and sizes are **percentages of the page** (0–100). `page` starts at 1.

```json
{
  "title": "הסכם שירות",
  "type": "DOCUMENT",
  "meta": {
    "language": "he"
  },
  "recipients": [
    {
      "email": "client@example.com",
      "name": "ישראל ישראלי",
      "role": "SIGNER",
      "fields": [
        {
          "type": "SIGNATURE",
          "page": 1,
          "positionX": 10,
          "positionY": 80,
          "width": 25,
          "height": 8,
          "fieldMeta": {
            "type": "signature",
            "label": "חתימה",
            "signatureTypes": ["draw"],
            "required": true
          }
        },
        {
          "type": "SIGNATURE",
          "page": 1,
          "positionX": 60,
          "positionY": 80,
          "width": 25,
          "height": 8,
          "fieldMeta": {
            "type": "signature",
            "label": "חותמת",
            "signatureTypes": ["upload"],
            "required": true
          }
        }
      ]
    }
  ]
}
```

### curl

```bash
curl -X POST "https://yazamco-documenso.up.railway.app/api/v2/envelope/create" \
  -H "Authorization: api_xxxxxxxxxxxxxxxx" \
  -F 'payload=<payload.json;type=application/json' \
  -F "files=@contract.pdf;type=application/pdf"
```

Save the JSON above as `payload.json`. The response contains the new document ID:

```json
{ "id": "envelope_xxxxxxxxxxxxxxxx" }
```

The document is created as a **draft**. Nothing is sent yet.

### Email subject with the customer name

`title` is used in the "signing complete" email subject:

```
החתימה הושלמה: <title>
```

Put the customer name in `title` (e.g. `"title": "ישראל ישראלי"`) to get `החתימה הושלמה: ישראל ישראלי`.
The subject is in Hebrew when the document language is Hebrew. Keep `"meta": { "language": "he" }` in the payload.

---

## Send it

`POST /envelope/distribute` (JSON body):

```bash
curl -X POST "https://yazamco-documenso.up.railway.app/api/v2/envelope/distribute" \
  -H "Authorization: api_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "envelopeId": "envelope_xxxxxxxxxxxxxxxx",
    "meta": {
      "distributionMethod": "EMAIL",
      "subject": "מסמך לחתימה",
      "message": "נא לחתום ולהטביע חותמת"
    }
  }'
```

- `"distributionMethod": "EMAIL"` emails the signers.
- `"distributionMethod": "NONE"` sends nothing. Use the `signingUrl` of each recipient in the response to send the links yourself.

---

## Add or change fields on an existing draft

Add fields: `POST /envelope/field/create-many`

```json
{
  "envelopeId": "envelope_xxxxxxxxxxxxxxxx",
  "data": [
    {
      "recipientId": 123,
      "type": "SIGNATURE",
      "page": 1,
      "positionX": 60,
      "positionY": 80,
      "width": 25,
      "height": 8,
      "fieldMeta": {
        "type": "signature",
        "label": "חותמת",
        "signatureTypes": ["upload"]
      }
    }
  ]
}
```

Instead of coordinates, you can place a field on text in the PDF. Write e.g. `{{stamp}}` in the PDF, then use
`"placeholder": "{{stamp}}"` in place of `page`/`positionX`/`positionY`/`width`/`height`.

Change fields: `POST /envelope/field/update-many`. This uses the same shape with the field `id` instead of `recipientId`, for example to fix a field set to the wrong type:

```json
{
  "envelopeId": "envelope_xxxxxxxxxxxxxxxx",
  "data": [
    {
      "id": 456,
      "type": "SIGNATURE",
      "fieldMeta": { "type": "signature", "label": "חותמת", "signatureTypes": ["upload"] }
    }
  ]
}
```

Get the recipient and field IDs from `GET /envelope/{envelopeId}`.

---

## Full API reference

The complete OpenAPI specification is at:
`https://yazamco-documenso.up.railway.app/api/v2/openapi.json`
