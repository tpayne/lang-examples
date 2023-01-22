using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Collections.Generic;
using System.Text.Json;
using System.Text;
using System.IO;
using Newtonsoft.Json;
using System.Net;
using System.Web;

using WebRestAPI.Models;

namespace WebRestAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MonitorController : ControllerBase
    {
        private ActionsController ghActions = new ActionsController();


        // GET: api/workflow/version
        [HttpGet("version/")]
        public string GetVersion()
        {
            return "This is workflow version 1.0";
        }

        // GET: api/actions/
        [HttpGet("")]
        public HttpResponseMessage UnsupportedMethod()
        {
            var resp = new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent("Unsupported method"),
                ReasonPhrase = "Unsupported method"
            };
            return resp;            
        }
    }
}
