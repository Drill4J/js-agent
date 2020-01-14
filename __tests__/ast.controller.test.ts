import request from "supertest";
import { app, server } from '../src/index'

beforeEach(async () => {
    await server.close();
});

test('should test ast controller', async () => {
    const data = [{ 
      filePath: "/src/js/demo.js",
      result: {
          className: '',
          methods: [
              {
                  name: 'demo',
                  loc: {

                  },
                  params: [

                  ],
                  body: {

                  }
              }
          ]
      }  
    }]  
    
    
    const res = await request(app.app)
      .post('/ast')
      .send(data);

      expect(res.status).toEqual(200)
      expect(res.body).toEqual({"status": "ast data saved"})
})