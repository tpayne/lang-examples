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
using System.Text.Json.Serialization;
using System.Text;
using System.IO;
using Newtonsoft.Json;
using System.Net;
using System.Web;
using System.Threading;

using WebRestAPI.Models;

namespace WebRestAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MonitorController : ControllerBase
    {
        private ActionsController ghActions = new ActionsController();

        //
        // Private classes
        //
        private async Task<dynamic> MatchJobStep(string owner, string repoName, string creds,
                                           string jobId, long iUid)
        {
            try 
            {
                Stream jobList = await ghActions.GetJobRunCmd(owner, repoName,
                                        creds, iUid);
                if (jobList == null)
                {
                    return -1;
                }

                var options = new JsonSerializerOptions
                {
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
                };

                GithubJobs jobsSteps = await System.Text.Json.JsonSerializer.DeserializeAsync<GithubJobs>(jobList,options);

                if ((jobsSteps == null) || jobsSteps.noJobs == 0)
                {
                    return -1;
                }

                foreach (Job iJob in jobsSteps.jobs)
                {
                    foreach (Step iStep in iJob.steps)
                    {
                        if (iStep.name.Equals(jobId))
                        {
                            return(iJob.run_id);
                        }
                    }
                }
                return 0L;
            }
            catch(Exception e)
            {
                return -1;
            }
        }

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
            DateTime runDate = DateTime.UtcNow;
            long runUid = 0L;
            long milliseconds = DateTime.Now.Ticks / TimeSpan.TicksPerMillisecond;

            string creds = Utils.GetCreds(Request);
            string jobId = JobValues.JOB_PREFIX + milliseconds.ToString();

            //
            // Submit the build job
            //
            try
            {
                RunWorkflowsCmdParams cmdParm = new RunWorkflowsCmdParams();

                cmdParm.revisionId = "master";
                cmdParm.AddParam("id", jobId);

                HttpResponseMessage resp = await ghActions.RunWorkflowCmd(owner, repoName,
                                                                workflowId,
                                                                cmdParm,
                                                                creds);

                if (resp.StatusCode == HttpStatusCode.OK ||
                    resp.StatusCode == HttpStatusCode.NoContent)
                {
                }
                else
                {
                    return resp.ReasonPhrase;
                }
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

            try
            {
                Thread.Sleep(JobValues.JOB_SLEEP);
                int count = 0;
                bool err = false;
                GithubWorkflowRuns runs = null;

                do
                {
                    try
                    {
                        runs = null;
                        Stream jobsList = await ghActions.ListJobsCmd(owner, repoName,
                                                        creds,
                                                        runDate);
                        if (jobsList == null)
                        {
                            count++;
                            if (count > 5)
                            {
                                err = true;
                            }
                            else
                            {
                                Thread.Sleep(JobValues.JOB_SLEEP);
                            }
                            continue;
                        }

                        runs = await System.Text.Json.JsonSerializer.DeserializeAsync<GithubWorkflowRuns>(jobsList);

                        if (runs == null || runs.noRuns == 0)
                        {
                            count++;
                            if (count > 5)
                            {
                                err = true;
                            }
                            else
                            {
                                Thread.Sleep(JobValues.JOB_SLEEP);
                            }
                            continue;
                        }
                        break;
                    }
                    catch (Exception e)
                    {
                    }

                } while (!err);

                if (runs.noRuns == 0 || err)
                {
                    return "{\"message\":\"No job runs detected\",\"documentation_url\":\"n/a\"}";
                }

                foreach (WorkflowRun i in runs.runs)
                {
                    if (i.workflow_id == workflowId)
                    {
                        long retCode = -1;

                        count = 0;
                        err = false;

                        do
                        {
                            try
                            {
                                retCode = await MatchJobStep(owner,repoName,creds,
                                                       jobId,i.id);
                                if (retCode > 0L)
                                {
                                    runUid = retCode;
                                    break;
                                }
                                else
                                {
                                    count++;
                                    if (count > 5)
                                    {
                                        err = true;
                                    }
                                    else
                                    {
                                        Thread.Sleep(JobValues.JOB_SLEEP);
                                    }
                                    continue;
                                }
                            }
                            catch (Exception e)
                            {
                            }

                        } while (!err);

                        if (err)
                        {
                            return "{\"message\":\"No job steps detected\",\"documentation_url\":\"n/a\"}";
                        }
                    }
                }

                if (runUid == 0L)
                {
                    return "{\"message\":\"Matching job name not found\",\"documentation_url\":\"n/a\"}";
                }
                string runJson = "{\"runUid\":\"" + runUid + "\",\"runName\":\"" + jobId + "\"}";
                return Utils.FormatJson(runJson);
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
