using System;
using System.IO;

namespace test
{
    class Parser
    {
        private bool debug = false;
        private bool verbose = false;
        private string fileName = null;

        public string getFileName() { return fileName; }
        public bool isVerbose() { return verbose; }
        public bool isDebug() { return debug; }

        public Parser(string[] args)
        {
            ParseArgs(args);
        }

        private void ParseArgs(string[] args)
        {
            for (int i = 0; i < args.Length; i++)
            {
                if(args[i] != null)
                {
                    if (args[i].Equals("--debug"))
                        debug = true;
                    else if (args[i].Equals("-v") || args[i].Equals("--verbose"))
                        verbose = true;
                    else if (args[i].Equals("-f") || args[i].Equals("--file"))
                    {
                        fileName = args[(i+1)];
                    }
                }
            }
            return;
        }
    }


    class Program
    {
        static void Main(string[] args)
        {
            Parser data = new Parser(args);
            
            Console.WriteLine("Args = " + data.isDebug() + " " + data.isVerbose() + " " + data.getFileName());

            string fileTxt = "";

            StreamReader reader = new StreamReader(data.getFileName());
            try
            {
                do
                {
                    fileTxt += reader.ReadLine();
                    fileTxt += "\n";
                }
                while (reader.Peek() != -1);
            }
            catch
            {
            }
            finally
            {
                reader.Close();
            }

            Console.WriteLine("File contents = \"" + fileTxt + "\"");

            return;
        }
    }
}
