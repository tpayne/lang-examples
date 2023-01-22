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
        private GithubUtilities utils = new GithubUtilities();

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


        // POST: api/actions/submit/{owner}/{repoName}/{workflow_id}/execute
        [HttpPost("{owner}/{repoName}/{workflowId:long}/execute")]
        public async Task<dynamic> PostStartWorkflow(string owner, string repoName,
                                                   long workflowId)
        {
            string iso = DateTime.UtcNow.ToString("s");

            //
            // Submit the build job
            //
            try
            {
                RunWorkflowsCmdParams cmdParm = new RunWorkflowsCmdParams();
                long milliseconds = DateTime.Now.Ticks / TimeSpan.TicksPerMillisecond;
                string creds = utils.GetCreds(Request);

                cmdParm.revisionId = "master";
                cmdParm.AddParam("id", JobValues.JOB_PREFIX+milliseconds.ToString());

                HttpResponseMessage resp = await ghActions.RunWorkflowCmd(owner, repoName, 
                                                                workflowId,
                                                                cmdParm,
                                                                creds);
                if (resp.StatusCode != HttpStatusCode.OK ||
                    resp.StatusCode != HttpStatusCode.NoContent)
                {
                    return resp.ReasonPhrase;
                }
                return resp.StatusCode;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                var resp = new HttpResponseMessage(HttpStatusCode.InternalServerError)
                {
                    Content = new StringContent("Server generated an exception"),
                    ReasonPhrase = "Server generated an exception"
                };
                return resp;
            }
        }
    }
}
