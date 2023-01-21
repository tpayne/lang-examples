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
    public class actionsController : ControllerBase
    {
        private async Task<Stream> ListActions(string owner, string repoName, string creds)
        {
            try
            {
                HttpClient client = new HttpClient();
                client.DefaultRequestHeaders.Accept.Clear();
                client.DefaultRequestHeaders.Accept.Add(
                    new MediaTypeWithQualityHeaderValue("application/vnd.github.v3+json")
                );
                client.DefaultRequestHeaders.Add("User-Agent", ".NET Foundation Repository Reporter");
                client.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
                client.DefaultRequestHeaders.Add("Authorization", "Bearer " + creds);

                string uri = "https://api.github.com/repos/" + owner + "/" + repoName + "/actions/workflows";
                var streamTask = client.GetStreamAsync(uri);
                Stream msg = await streamTask;

                return msg;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;
            }
        }

        private async Task<HttpResponseMessage> DispatchWorkflow(string owner, string repoName,
                                                   int workflowId, RunWorkflowsCmd cmdParams)
        {
            try
            {
                HttpClient client = new HttpClient();

                var header = AuthenticationHeaderValue.Parse(Request.Headers["Authorization"]);
                var credentials = header.Parameter;

                client.DefaultRequestHeaders.Add("User-Agent", ".NET Foundation Repository Reporter");
                client.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
                client.DefaultRequestHeaders.Add("Authorization", "Bearer " + credentials);
                client.DefaultRequestHeaders.Accept.Clear();
                client.DefaultRequestHeaders.Accept.Add(
                    new MediaTypeWithQualityHeaderValue("application/vnd.github+json")
                );

                string uri = "https://api.github.com/repos/" + owner + "/" +
                                repoName + "/actions/workflows/" + workflowId +
                                "/dispatches";

                var response = client.PostAsJsonAsync<RunWorkflowsCmd>(uri,cmdParams);
                HttpResponseMessage msg = await response;
                var reason = msg.Content.ReadAsStringAsync().Result;
                var resp = new HttpResponseMessage(msg.StatusCode)
                {
                    Content = msg.Content,
                    ReasonPhrase = reason
                };
                return resp;
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

        // GET: api/workflow/version
        [HttpGet("version/")]
        public string GetVersion()
        {
            return "This is workflow version 1.0";
        }

        // GET: api/workflow/query/{owner}/{repo}/list
        [HttpGet("{owner}/{repoName}/list")]
        public async Task<GitHubActions> GetActions(string owner, string repoName)
        {
            try
            {
                var header = AuthenticationHeaderValue.Parse(Request.Headers["Authorization"]);
                var creds = header.Parameter;

                Stream actionsList = await ListActions(owner, repoName, creds);
                var actions = await System.Text.Json.JsonSerializer.DeserializeAsync<GitHubActions>(actionsList);
                return actions;
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: {0}", e.Message + "\n" + e.StackTrace);
                return null;                
            }
        }


        // POST: api/actions/submit/{owner}/{repoName}/{workflow_id}/execute
        [HttpPost("{owner}/{repoName}/{workflowId:int}/execute")]
        public async Task<HttpResponseMessage> PostStartWorkflow(string owner, string repoName,
                                                   int workflowId,
                                                   [FromBody] RunWorkflowsCmd cmdParams)
        {
            try
            {
                HttpResponseMessage resp = await DispatchWorkflow(owner,repoName,
                                                                  workflowId,cmdParams);
                if (resp.StatusCode != HttpStatusCode.OK)
                {
                }
                return resp;
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
