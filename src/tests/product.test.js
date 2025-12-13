import app from "../../app";
import supertest from "supertest";

const request = supertest(app);

describe("GET /api/products/:productId", () => {
  beforeAll(async () => {
    const mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });
  it("Should return product when productId is valid", async () => {
    // Assuming you already have a product with a known ID in your DB for testing
    const productId = "68e8b908f455e0f57a0eaf11"; // Replace with a valid productId from your DB

    const response = await request
      .get(`/api/products/68e8b908f455e0f57a0eaf11`)
      .expect(200); // Expect 200 OK status

    // Check if the response has a success property
    expect(response.body.success).toBe(true);
    expect(response.body.product).toHaveProperty(
      "_id",
      "68e8b908f455e0f57a0eaf11"
    ); // Ensure the product has the correct ID
  }, 50000);

  it("Should return 404 when product is not found", async () => {
    // Use a non-existing productId for testing
    const productId = "non-existing-id";

    const response = await request
      .get(`/api/products/${productId}`)
      .expect(404); // Expect 404 status

    // Check if the response message is correct
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Product not found");
  }, 50000);
});
