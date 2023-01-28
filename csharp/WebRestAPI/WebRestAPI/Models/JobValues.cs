/*
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

namespace WebRestAPI.Models
{
    public class JobValues
    {
        public readonly static string JOB_PREFIX = "JobRun-";
        public readonly static int JOB_SLEEP = 5000;
        public readonly static int JOB_RETRY = 5;

        // Messages
        public readonly static string JOB_NOT_FOUND = "{\"message\":\"No job steps detected\",\"documentation_url\":\"n/a\"}";
        public readonly static string JOB_MATCH_NOT_FOUND = "{\"message\":\"Matching job name not found\",\"documentation_url\":\"n/a\"}";
        public readonly static string JOB_NO_RUNS = "{\"message\":\"No job runs detected\",\"documentation_url\":\"n/a\"}";
        public readonly static string JOB_NO_LOGS = "{\"message\":\"No job logs detected\",\"documentation_url\":\"n/a\"}";
    }
}
